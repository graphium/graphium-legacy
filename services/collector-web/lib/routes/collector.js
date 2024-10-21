var express = require('express');
var auth = require('../util/authMiddleware');
var router = express.Router();
var ImportBatchDAO = require('../dao/ImportBatchDAO.js');
var multer = require('multer');
var autoReap = require('multer-autoreap');
var upload = multer()
var uuid = require('uuid');
var AWS = require('aws-sdk');
var s3 = require('../util/s3Util.js');
var templateHelpers = require('../util/templateHelpers');
var roleGroups = require('../util/roleGroups');
var _ = require('lodash');
var OrgUserDAO = require('../dao/org/OrgUserDAO.js');
var FacilityDAO = require('../dao/org/FacilityDAO.js');
var ProviderDAO = require('../dao/org/ProviderDAO.js');
var ValueSetDAO = require('../dao/org/ValueSetDAO.js');
var ImportEventDAO = require('../dao/ImportEventDAO.js');
var ImportFaxLineDAO = require('../dao/ImportFaxLineDAO.js');
var DataEntryFormDefinitionDAO = require('../dao/DataEntryFormDefinitionDAO');
var ExternalWebFormDAO = require('../dao/ExternalWebFormDAO');
var FtpSiteDAO = require('../dao/FtpSiteDAO.js');
var ImportBatchTemplateDAO = require('../dao/ImportBatchTemplateDAO.js');
var FlowDAO = require('../dao/FlowDAO.js');
var Promise = require('bluebird');
var moment = require('moment');
var InterfaxInbound = require('../services/interfax/InterfaxInbound.js');
var IndexOrganizationDAO = require('../dao/index/IndexOrganizationDAO');
var TransactionLog = require('../log/TransactionLog');

/* GET user profile. */
router.get('/', auth.ensureAuthenticatedOrg(), function(req, res, next) {
    res.redirect('/collector/batches');
});

router.get(
    '/signed-s3.json',
    auth.ensureAuthenticatedOrg({ permissions: ['IMPORT_BATCH:CREATE'] }),
    function(req, res, next) {
        var fileType = decodeURIComponent(req.query.fileType);
        var bucket = process.env.S3_TMP_IMPORT_BATCH_DATA;
        var id = uuid.v4();
        var s3 = new AWS.S3({ signatureVersion: 'v4' });
        var s3Params = {
            Bucket: bucket,
            Key: id,
            Expires: 60,
            ContentType: fileType
        };

        s3.getSignedUrl('putObject', s3Params, function(err, data) {
            if (err) {
                console.log(err);
                return res.end();
            }

            res.status(200).send({
                signedRequest: data,
                id: id 
            });
        });
    }
);

router.get('/faxLines/:importFaxLineGuid',
           auth.ensureAuthenticatedOrg({roles:{some:['DATA_ENTRY_SUPERVISOR','DATA_ENTRY_ADMIN']}}),
function(req, res, next) {
    var faxLine;
    ImportFaxLineDAO.getFaxLine(req.params.importFaxLineGuid)
    .then(function(faxLineResult) {
        faxLine = faxLineResult;

        // Ensure this fax line is for this org.
        if(faxLine.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        return Promise.all([
            ImportFaxLineDAO.getFaxesForLine(req.params.importFaxLineGuid),
            FacilityDAO.getFacilities(req.session.org),
            ImportBatchTemplateDAO.getTemplatesForOrg(req.session.org)
        ]);
    })
    .spread(function(faxes, facilities, templates) {
        res.render('collector/faxLine', {
            faxLine: faxLine,
            faxes: faxes,
            templates: templates,
            facilities: facilities
        })
    })
    .catch(function(error) {
        res.render('error', {
            message: error.message,
            error: error
        });
    })
});

router.get('/faxLines',
           auth.ensureAuthenticatedOrg({roles:{some:['DATA_ENTRY_SUPERVISOR','DATA_ENTRY_ADMIN']}}),
function(req, res, next) {
    Promise.all([
        ImportFaxLineDAO.getFaxLinesForOrg(req.session.org),
        FacilityDAO.getFacilities(req.session.org),
        ImportBatchTemplateDAO.getTemplatesForOrg(req.session.org)
    ])
    .spread(function(faxLines, facilities, templates) {
        res.render('collector/faxLines', {
            faxLines: faxLines,
            facilities: facilities,
            templates: templates
        })
    })
});


router.post('/faxLines', auth.ensureAuthenticatedOrg(), auth.isGraphiumAdministrator(),
function(req, res, next) {
    var faxLineConfig = {
        //generateBatchFlowGuid: req.body.flowGuid
    };

    ImportFaxLineDAO.createFaxLine(req.session.org, req.body.facilityId ? parseInt(req.body.facilityId) : undefined, req.body.faxLineName, req.body.phoneNumber, req.body.generateBatchTemplateGuid, faxLineConfig)
    .then(function(faxLine) {
        res.redirect('/collector/faxLines');
    })
    .catch(function(error) {
        if(error.validationError)
            console.log(error.validationError);
        res.render('error', {
            message: error.message,
            error: error
        });
    });
});

router.post('/faxLines/:importFaxLineGuid', auth.ensureAuthenticatedOrg(), auth.isGraphiumAdministrator(),
function(req, res, next) {
    
    ImportFaxLineDAO.updateFaxLine(req.params.importFaxLineGuid, {
        facilityId: req.body.facilityId ? parseInt(req.body.facilityId) : undefined, 
        faxLineName: req.body.faxLineName, 
        phoneNumber: req.body.phoneNumber, 
        faxLineConfig: {
            //generateBatchFlowGuid: req.body.flowGuid
        },
        generateBatchTemplateGuid: req.body.generateBatchTemplateGuid
    })
    .then(function(faxLineGuid) {
        res.redirect('/collector/faxLines/'+faxLineGuid);
    })
    .catch(function(error) {
        if(error.validationError)
            console.log(error.validationError);
        res.render('error', {
            message: error.message,
            error: error
        });
    });
});

router.get('/batch/:importBatchGuid.pdf', 
           auth.ensureAuthenticatedOrg({permissions:{some:['IMPORT_BATCH:READ_ASSIGNED','IMPORT_BATCH:READ_ALL']}}),
function(req, res) {

    ImportBatchDAO.getBatchByGuid(req.params.importBatchGuid, true)
    .then(function(importBatch) {
        if(importBatch.batchDataType != 'pdf') {
            req.flash('error', 'Unable to open PDF for batch, this batch was not created with a PDF.');
            res.redirect('/collector/batch/'+req.params.importBatchGuid);
            return;
        }

        if(importBatch.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return Promise.reject(new Error('User does not have permission to view this PDF'));
        }

        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename='+ (importBatch.batchName || importBatch.importBatchGuid)+'.pdf',
            'Content-Length': importBatch.batchData.length
        });
        res.end(importBatch.batchData);

    })
    .catch(function(error) {
        req.flash('error', error.message);
        res.redirect(req.get('Referrer') || ('/collector/batch/'+req.params.importBatchGuid));
    })
});

router.post('/faxLines/:importFaxLineGuid/fax/:importFaxGuid/batches',  auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {

    var importFaxGuid = req.params.importFaxGuid;
    var importFaxLineGuid = req.params.importFaxLineGuid;

    Promise.all([
        ImportFaxLineDAO.getFaxLine(importFaxLineGuid),
        ImportFaxLineDAO.getFax(importFaxGuid),
        ImportFaxLineDAO.getFaxPdf(importFaxGuid)
    ])
    .spread(function(faxLine, fax, faxPdf) {
        console.log('Retrieved FTP data.');
        
        if(faxLine.orgInternalName != req.session.org) {
            return Promise.reject(new Error('Unable to generate batch, incorrect organization.'));
        }

        if(faxLine.importFaxLineGuid != fax.importFaxLineGuid) {
            return Promise.reject(new Error('Fax not belong to the specified fax line.'));
        }

        console.log('Creating batch for fax.');
        return ImportFaxLineDAO.createBatchForFax(faxLine, fax, faxPdf);
    })
    .then(function(batch) {
        console.log('Batch created for fax.');
        console.log(batch);
        res.locals.redirectWithSuccess('Successfully created batch.');
    })
    .catch(function(error) {
        res.locals.redirectWithError(error);
    });
});

router.get('/fax/(:importFaxGuid).pdf', 
           auth.ensureAuthenticatedOrg({roles:{some:['DATA_ENTRY_SUPERVISOR','DATA_ENTRY_ADMIN']}}),
function(req, res) {

    ImportFaxLineDAO.getFax(req.params.importFaxGuid, true)
    .then(function(importFax) {
        if(importFax.faxLine.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return Promise.reject(new Error('User does not have permission to view this PDF'));
        }
        else {
            return ImportFaxLineDAO.getFaxPdf(importFax.importFaxGuid);
        }
    })
    .then(function(importFaxPdf) {
        if(!importFaxPdf) {
            req.flash('error', 'Unable to find PDF for this batch.');
            res.redirect('/collector/faxLines');
        }
        else {
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline; filename='+req.params.importFaxGuid+'.pdf',
                'Content-Length': importFaxPdf.length
            });
            res.end(importFaxPdf);
        }
    })
    .catch(function(error) {
        req.flash('error', error.message);
        res.redirect(req.get('Referrer') || '/collector/faxLines/');
    })
});

// Unauthenticated callback to intake faxes from interfax service.
// TODO probably need to add some IP address based control or something.
router.post('/fax/interfax/:importFaxLineGuid', function(req, res, next) {
    var data = req.body;

    console.log('Attempting to import fax from interfax:');
    console.log(data);
    var fax;
    new InterfaxInbound().getRecord(data.TransactionID)
    .then(function(record) {
        // First let's create a timestamp.
        console.log('Retrieved record data from interfax:');
        console.log(record);
        var receiveTime
        try {
            var m = moment.utc(record.receiveTime, 'YYYY-MM-DDTHH:mm:ss');
            console.log('Parsed receive time from ' + record.receiveTime + ' => ' + m.toString() + ' ('+m.valueOf()+')');
            receiveTime = m.valueOf();
        }
        catch(error) {
            console.log('Error calculating receive time: ' + error.message);
            receiveTime = Date.now();
        }

        fax = {
            faxService: 'interfax',
            interfaxData: {
                transactionId: record.messageId.toString(),
                phoneNumber: record.phoneNumber,
                messageType: parseInt(record.messageType),
                messageSize: parseInt(record.messageSize),
                remoteCsid: record.remoteCSID || null,
                pages: parseInt(record.pages),
                status: parseInt(record.messageStatus),
                recordingDuration: parseInt(record.recordingDuration),
                receiveTime: record.receiveTime,
                callerId: record.callerId
            },
            interfaxTransactionId: record.messageId.toString(),
            pageCount: parseInt(record.pages),
            receivedAt: receiveTime,
            createdAt: Date.now(),
            callerId: record.callerId
        }
        return new InterfaxInbound().getImage(data.TransactionID);
    })
    .then(function(faxPdf) {
        return ImportFaxLineDAO.createFaxForLine(req.params.importFaxLineGuid, fax, faxPdf);
    })
    .then(function() {
        console.log('Completed receiving interfax fax.');
        res.status(200).send();
    })
    .catch(function(error) {
        console.log(error.message);
        console.log(error.stack);
        res.status(500).send('Unable to intake fax: ' + error.message);
    })
});


router.get('/externalWebForms', 
           auth.ensureAuthenticatedOrg({permissions:{some:['IMPORT_BATCH:READ_ASSIGNED','IMPORT_BATCH:READ_ALL']}}), 
function(req, res, next) {

    var facilities;
    var externalWebFormDefinitions;

    return Promise.all([
        FacilityDAO.getFacilities(req.session.org),
        ExternalWebFormDAO.getFormDefinitionsForOrg(req.session.org)
    ])
    .spread(function(facilitiesResult, externalWebFormDefinitionsResults) {
        facilities = facilitiesResult;
        externalWebFormDefinitions = externalWebFormDefinitionsResults;

        res.render('collector/externalWebForms', {
            facilities: facilities,
            externalWebFormDefinitions: externalWebFormDefinitions
        });
    })
    .catch(function(error) {
        res.render('error', {
            message: error.message,
            error: error
        });
    })
});

router.get('/batches', 
           auth.ensureAuthenticatedOrg({permissions:{some:['IMPORT_BATCH:READ_ASSIGNED','IMPORT_BATCH:READ_ALL']}}), 
function(req, res, next) {

    var assignedBatches;
    var dataEntryUsers;
    var flows;
    var templates;
    var facilities;

    return Promise.all([
        OrgUserDAO.getUsersByRoles(req.session.org, ['DATA_ENTRY_ADMIN','DATA_ENTRY_SUPERVISOR','DATA_ENTRY_CLERK']),
        ImportBatchDAO.getAssignedBatchesByUser(req.orgUser.userName, req.session.org),
        ImportBatchTemplateDAO.getTemplatesForOrg(req.session.org),
        FacilityDAO.getFacilities(req.session.org)
    ])
    .spread(function(usersResult, assignedBatchesResult, templatesResult, facilitiesResult) {
        dataEntryUsers = usersResult;
        assignedBatches = assignedBatchesResult;
        templates = templatesResult;
        facilities = facilitiesResult;

        if(_.includes(req.permissions, 'IMPORT_BATCH:READ_ALL')) {
            return Promise.all([
                ImportBatchDAO.getIncompleteBatches(req.session.org),
                ImportBatchDAO.getAllCompleteBatches(req.session.org)
            ]);
        }
        else {
            return Promise.resolve([ [], [] ]);
        }
    })
    .spread(function(incompleteBatches, completeBatches) {
        res.render('collector/batches', {
            assignedBatches: assignedBatches,
            dataEntryUsers: dataEntryUsers,
            templates: templates,
            facilities: facilities,
            incompleteBatches: incompleteBatches,
            completeBatches: completeBatches
        });
    })
    .catch(function(error) {
        res.render('error', {
            message: error.message,
            error: error
        });
    })
});

router.post('/batch/:importBatchGuid/facility/:facilityId', 
            auth.ensureAuthenticatedOrg({permissions:['IMPORT_BATCH:ASSIGN']}),
function(req, res, next) {

    var facilityId = parseInt(req.params.facilityId);
    var user;

    FacilityDAO.getFacilities(req.session.org)
    .then(function(facilitiesResult) {

        var facility = _.find(facilitiesResult, {facilityId: facilityId, activeIndicator: true});
        if(!facility) {
            return Promise.reject(new Error('Unable to set facility, that facility does not exist or is not active.'));
        }
        
        return ImportBatchDAO.setBatchFacility(req.params.importBatchGuid, facilityId);
    })
    .then(function() {
        return ImportEventDAO.createEvent({
            eventType: 'batch_facility_set',
            importBatchGuid: req.params.importBatchGuid,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org,
            eventData: {
                facilityId: facilityId
            }
        });
    })
    .then(function() {
        res.redirect(req.get('Referer'));
        return;
    })
    .catch(function(error) {
        res.render('error', {
            message: error.message,
            error: error
        });
    })
});

router.post('/batch/:importBatchGuid/openForProcessing/:userId', 
            auth.ensureAuthenticatedOrg({permissions:['IMPORT_BATCH:ASSIGN']}),
function(req, res, next) {

    var userId = parseInt(req.params.userId);
    var user;

    OrgUserDAO.getOrgUserById(req.session.org, userId)
    .then(function(userResult) {
        user = userResult;
        var userRoles = _.flatMap(user.roles, 'roleName');
        if(_.intersection(userRoles, roleGroups.dataEntryClerkRoles).length == 0) {
            return Promise.reject(new Error('Unable to open batch, user ' + user.userName + ' does not have permission to do data entry.'));
        }
        return ImportBatchDAO.openBatchForProcessing(req.params.importBatchGuid, user.userName);
    })
    .then(function() {
        return ImportEventDAO.createEvent({
            eventType: 'batch_opened',
            importBatchGuid: req.params.importBatchGuid,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org,
            eventData: {
                assignedTo: user.userName
            }
        });
    })
    .then(function() {
        res.redirect(req.get('Referer'));
        return;
    })
    .catch(function(error) {
        res.render('error', {
            message: error.message,
            error: error
        });
    })
});


router.post('/batch/:importBatchGuid/template/:templateGuid', 
            auth.ensureAuthenticatedOrg({permissions:['IMPORT_BATCH:ASSIGN']}),
function(req, res, next) {
    var batch;
    var template;

    Promise.all([
        ImportBatchDAO.getBatchByGuid(req.params.importBatchGuid),
        ImportBatchTemplateDAO.getTemplate(req.params.templateGuid)
    ])
    .spread(function(batchResult, templateResult) {
        batch = batchResult;
        template = templateResult;

        if(batch.orgInternalName != req.session.org ) {
            return Promise.reject(new Error('Unable to update batch template, invalid batch.'));
        }

        if(!template.systemGlobal && template.orgInternalName != req.session.org) {
            return Promise.reject(new Error('Unable to update batch template, invalid template.'));
        }

        return ImportBatchDAO.updateBatchTemplate(batch.importBatchGuid, template.templateGuid);
    })
    .then(function() {
        return ImportEventDAO.createEvent({
            eventType: 'batch_template_change',
            importBatchGuid: req.params.importBatchGuid,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org,
            eventData: {
                oldTemplateGuid: batch.batchTemplateGuid,
                newTemplateGuid: req.params.templateGuid
            }
        });
    })
    .then(function() {
        res.redirect(req.get('Referer'));
        return;
    })
    .catch(function(error) {
        res.render('error', {
            message: error.message,
            error: error
        });
    })
});

router.post('/batch/:importBatchGuid/assign/:userId', 
            auth.ensureAuthenticatedOrg({permissions:['IMPORT_BATCH:ASSIGN']}),
function(req, res, next) {
    var user;

    OrgUserDAO.getOrgUserById(req.session.org, req.params.userId)
    .then(function(userResult) {
        user = userResult;
        var userRoles = _.flatMap(user.roles, 'roleName');
        if(_.intersection(userRoles, roleGroups.dataEntryClerkRoles).length == 0) {
            return Promise.reject(new Error('Unable to assign user to batch, user ' + user.userName + ' does not have permission to accept batchces.'));
        }
        return ImportBatchDAO.assignBatch(req.params.importBatchGuid, user.userName);
    })
    .then(function() {
        return ImportEventDAO.createEvent({
            eventType: 'batch_assigned',
            importBatchGuid: req.params.importBatchGuid,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org,
            eventData: {
                assignedTo: user.userName
            }
        });
    })
    .then(function() {
        res.redirect(req.get('Referer'));
        return;
    })
    .catch(function(error) {
        res.render('error', {
            message: error.message,
            error: error
        });
    })
});

router.post('/batch/:importBatchGuid/ignoreRecordsPendingReview', 
            auth.ensureAuthenticatedOrg({permissions:['IMPORT_BATCH:ASSIGN']}),
function(req, res, next) {
    ImportBatchDAO.ignoreAllBatchRecordsPendingReview(req.params.importBatchGuid)
    .then(function() {
        req.flash('success', 'Batch records ignored.');
        return ImportEventDAO.createEvent({
            eventType: 'batch_ignored',
            importBatchGuid: req.params.importBatchGuid,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        });
    })
    .then(function() {
        res.redirect(req.get('Referer'));
        return;
    })
    .catch(function(error) {
        res.render('error', {
            message: error.message,
            error: error
        });
    })
});

router.post(
    '/batches', 
    auth.ensureAuthenticatedOrg({permissions:['IMPORT_BATCH:CREATE']}), 
    function(req, res, next) {
        console.log('Attempting to upload file of type: ' + req.body.fileType);
        if( req.body.fileType != 'application/pdf' && !_.startsWith(req.body.fileType,'text/') )
            throw new Error('Unable to create batch, invalid file type.');

        var templateGuid = req.body.templateGuid;
        var batchData;// = _.startsWith(req.file.mimetype,'text/') ? req.file.buffer.toString() : req.file.buffer;
        var batchName = req.body.batchName;
        var receivedAt = parseInt(req.body.receivedAtTimestamp);
        var facilityId = parseInt(req.body.facilityId);
        var fileId = req.body.fileId;
        var fileType = req.body.fileType;

        s3.getObjectBody(process.env.S3_TMP_IMPORT_BATCH_DATA, fileId)
            .then(function(data) {
                batchData = _.startsWith(fileType,'text/') ? data.toString() : data;

                if(facilityId == null || !batchName || !templateGuid || !batchData || !receivedAt) {
                    res.locals.redirectWithError('Missing fields required to create batch.');
                    return;
                }

                var createdBatch;
                // create batch object
                // TODO: validate that the user being assigned to is a valid user...
                // call DAO to create the batch
                return ImportBatchTemplateDAO.getTemplate(templateGuid);
            })
            .then(function(template) {
                if(!template.systemGlobal && template.orgInternalName != req.session.org) {
                    return Promise.reject(new Error('Unable to create batch, invalid template for this organization.'));
                }
                    
                var importBatch = {
                    batchName: batchName,
                    orgInternalName: req.session.org,
                    facilityId: facilityId,
                    batchTemplateGuid: template.templateGuid,
                    batchSource: 'manual',
                    batchSourceIds: {
                        userName: req.orgUser.userName
                    },
                    batchDataType: template.batchDataType,
                    batchDataTypeOptions: template.batchDataTypeOptions,
                    requiresDataEntry: template.requiresDataEntry,
                    flowGuid: template.flowScriptGuid,
                    dataEntryFormDefinitionName: template.dataEntryFormDefinitionName,
                    receivedAt: receivedAt,
                    processingType: 'flow',
                    batchData: batchData,
                };
                return ImportBatchDAO.createBatch(importBatch, template);
            })
            .then(function(createdBatchResult) {
                createdBatch = createdBatchResult;
                return ImportEventDAO.createEvent({
                    eventType: 'batch_created',
                    importBatchGuid: createdBatch.importBatchGuid,
                    userName: req.orgUser.userName,
                    indexUserId: req.indexUserId,
                    orgUserId: req.orgUserId,
                    orgInternalName: req.session.org
                });
            })
            .then(function() {
                return s3.deleteObject(process.env.S3_TMP_IMPORT_BATCH_DATA, fileId);
            })
            .then(function() {
                res.status(200).send({batchUrl: '/collector/batch/'+createdBatch.importBatchGuid, batchId: createdBatch.importBatchGuid});
            })
            .catch(function(error) {
                console.error('Unable to create manual batch:');
                console.error(error);
                res.locals.redirectWithError(error.message);
            });
});

router.get('/batch/:importBatchGuid', 
           auth.ensureAuthenticatedOrg({permissions:{some:['IMPORT_BATCH:READ_ASSIGNED','IMPORT_BATCH:READ_ALL']}}), 
function(req, res, next) {

    var dataEntryUsers;
    var importBatch;
    var facilities;
    var sourceData;
    var importBatchTemplates;

    Promise.all([
        OrgUserDAO.getUsersByRoles(req.session.org, ['DATA_ENTRY_ADMIN','DATA_ENTRY_SUPERVISOR','DATA_ENTRY_CLERK']),
        FacilityDAO.getFacilities(req.session.org),
        ImportBatchTemplateDAO.getTemplatesForOrg(req.session.org)
    ]).spread(function(usersResult, facilitiesResult, importBatchTemplatesResult) {
        facilities = facilitiesResult;
        dataEntryUsers = usersResult;
        importBatchTemplates = importBatchTemplatesResult;

        return ImportBatchDAO.getBatchByGuid(req.params.importBatchGuid, false, true, false)
    })
    .then(function(importBatchResult) {
        importBatch = importBatchResult;
        if(importBatch && importBatch.batchSourceIds && importBatch.batchSourceIds.ftpFileGuid) {
            // Let's get the ftp info fo display on the batch page, but also catch the error if
            // something goes wrong.
            return FtpSiteDAO.getFtpFile(importBatch.batchSourceIds.ftpFileGuid, true)
            .catch(function(error) {
                return Promise.resolve(null);
            })
        }
        else if(importBatch && importBatch.batchSourceIds && importBatch.batchSourceIds.importFaxGuid) {
            console.log(' RETRIEVING FAX INFO FOR BATCH:  ' + importBatch.importBatchGuid + ' FAX: ' + importBatch.batchSourceIds.importFaxGuid );
            return ImportFaxLineDAO.getFax(importBatch.batchSourceIds.importFaxGuid, true)
            .catch(function(error) {
                return Promise.resolve(null);
            })
        }
    })
    .then(function(sourceDataResult) {
        sourceData = sourceDataResult;

        if(importBatch.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        var hasReadAllPermission = _.includes(req.permissions, 'IMPORT_BATCH:READ_ALL');
        if(!hasReadAllPermission && importBatch.assignedTo != req.orgUser.userName) {
            console.log('User does not have appropriate permission, returning to page.');
            req.session.errorMessages = ['Unable to open batch, you are not assigned to this batch.'];
            req.session.save();
            res.redirect(req.get('Referrer') || '/collector/batches');
            return;
        }
        return ImportEventDAO.createEvent({
            eventType: 'batch_opened',
            importBatchGuid: importBatch.importBatchGuid,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        })
    })
    .then(function() {
        res.render('collector/batch', {
            importBatch: importBatch,
            facilities: facilities,
            dataEntryUsers: dataEntryUsers,
            sourceData: sourceData,
            importBatchTemplates: importBatchTemplates
        });
    })
    .catch(function(error) {
        console.log(error.message);
        if(error.validationError) {
            console.log(error.validationError);
        }
        res.render('error', {
            error:error
        });
    })
});

// Used by the form to post the data for saving in a ajax request.
router.post('/batch/record/:importBatchGuid/:recordIndex(\\d+)/:dataEntryFormDefinitionName/:dataEntryFormDefinitionVersion(\\d+)/data.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var recordIndex = parseInt(req.params.recordIndex);
    var dataEntryFormDefinitionName = req.params.dataEntryFormDefinitionName;
    var dataEntryFormDefinitionVersion = parseInt(req.params.dataEntryFormDefinitionVersion);
    var dataEntryData = req.body;
    var importBatchRecord;
    var importBatch;

    var tl = new TransactionLog('SAVE_DATA_ENTRY_DATA', {
        importBatchGuid: importBatchGuid,
        recordIndex: recordIndex,
        dataEntryFormDefinitionName: dataEntryFormDefinitionName,
        dataEntryFormDefinitionVersion: dataEntryFormDefinitionVersion
    });    

    if(!_.isPlainObject(dataEntryData)) {
        tl.logError('IVLD_FORMAT','Data entry data is not in correct format.');
        tl.finishTransaction();

        res.status(400).send('Data entry data is not in correct format.');
    }

    tl.logInfo('GET_BATCH','Retrieving batch by guid.');
    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {

        importBatch = importBatchResult;
        if(importBatch.orgInternalName != req.session.org) {
            tl.logError('UNAUTH','User not authorized to edit batch.');
            tl.finishTransaction();
            res.redirect('/user/restricted');
            return;
        }

        tl.logInfo('GET_BATCH_RECORD','Retrieving batch record by index.');
        return ImportBatchDAO.getBatchRecord(importBatchGuid, recordIndex)
    })
    .then(function(importBatchRecordResult) {
        importBatchRecord = importBatchRecordResult;
        tl.logInfo('SAVE','Saving data entry data.');
        return ImportBatchDAO.saveRecordDataEntryData(importBatchGuid, recordIndex, dataEntryData, dataEntryFormDefinitionName, dataEntryFormDefinitionVersion)
    })
    .then(function(dataEntryData) {
        tl.logInfo('CREATE_EVENT','Creating data entry audit events.');
        var promises = [];
        promises.push(ImportEventDAO.createEvent({
            eventType: 'record_data_entered',
            importBatchGuid: importBatchRecord.importBatchGuid,
            importBatchRecordGuid: importBatchRecord.importBatchGuid,
            importBatchGuidRecordIndex: importBatchGuid + ':' + recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org,
            eventData: {
                isInitialDataEntry: importBatchRecord.recordStatus == 'pending_data_entry',
                dataEntryFormDefinitionName: dataEntryFormDefinitionName,
                dataEntryFormDefinitionVersion: dataEntryFormDefinitionVersion,
                responsibleProviderIds: dataEntryData.responsibleProviderIds,
                primaryResponsibleProviderId: dataEntryData.primaryResponsibleProviderId
            }
        }, tl));

        promises.push(ImportEventDAO.createEvent({
            eventType: 'record_status_update',
            importBatchGuid: importBatchRecord.importBatchGuid,
            importBatchRecordGuid: importBatchRecord.importBatchGuid,
            importBatchGuidRecordIndex: importBatchGuid + ':' + recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org,
            eventData: {
                statusFrom: importBatchRecord.recordStatus,
                statusTo: 'pending_processing'
            }
        },tl));

        return Promise.all(promises);
    })
    .then(function() {
        res.status(200).send();
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error.stack);
        res.status(400).send(error.message);
    });
});

// Used by the form to undiscard a record.
router.post('/batch/record/:importBatchGuid/:recordIndex(\\d+)/undiscard.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var recordIndex = parseInt(req.params.recordIndex);

    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatch) {
        if(importBatch.orgInternalName != req.session.org) {
            return Promise.reject(new Error('User not authorized to discard record.'));
        }
        else {
            return ImportBatchDAO.undiscardRecord(importBatchGuid, recordIndex)
        }
    })
    .then(function(undiscardedBatchRecord) {
        return ImportEventDAO.createEvent({
            eventType: 'record_undiscarded',
            importBatchGuid: undiscardedBatchRecord.importBatchGuid,
            importBatchRecordGuid: undiscardedBatchRecord.importBatchRecordGuid,
            importBatchGuidRecordIndex: undiscardedBatchRecord.importBatchGuid + ':' + undiscardedBatchRecord.recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        });
    })
    .then(function() {
        res.status(200).send();
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error);
        res.status(400).send(error.message);
    });
});


router.post('/batch/record/:importBatchGuid/:recordIndex(\\d+)/discard.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var recordIndex = parseInt(req.params.recordIndex);
    var reason = req.body && req.body.reason ? req.body.reason.toString() : null;

    if(!reason) {
        res.status(400).send('Must specify a reason to discard a record.');
        return;
    }

    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatch) {
        if(importBatch.orgInternalName != req.session.org) {
            return Promise.reject(new Error('User not authorized to discard record.'));
        }
        else {
            return ImportBatchDAO.discardRecord(importBatchGuid, recordIndex, reason)
        }
    })
    .then(function(discardedBatchRecord) {
        return ImportEventDAO.createEvent({
            eventType: 'record_discarded',
            importBatchGuid: discardedBatchRecord.importBatchGuid,
            importBatchRecordGuid: discardedBatchRecord.importBatchRecordGuid,
            importBatchGuidRecordIndex: discardedBatchRecord.importBatchGuid + ':' + discardedBatchRecord.recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        });
    })
    .then(function() {
        res.status(200).send();
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error);
        res.status(400).send(error.message);
    });
});

// Used by the form to discard a record.
router.post('/batch/record/:importBatchGuid/:recordIndex/reprocess.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var recordIndex = parseInt(req.params.recordIndex);
    var reprocessResult;
    var importBatch;
    var importBatchRecord;

    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;
        if(importBatch.orgInternalName != req.session.org) {
            return Promise.reject(new Error('User not authorized.'));
        }
        else {
            return ImportBatchDAO.getBatchRecord(importBatchGuid, recordIndex);
        }
    })
    .then(function(importBatchRecordResult) {
        importBatchRecord = importBatchRecordResult;
        //console.log('Submitting record for processing.');
        return ImportBatchDAO.submitRecordForProcessing(importBatchRecord);
    })
    .then(function() {
        //console.log('Adding to reprocessing queue.');
        return ImportEventDAO.createEvent({
            eventType: 'record_reprocess',
            importBatchGuid: importBatchRecord.importBatchGuid,
            importBatchRecordGuid: importBatchRecord.importBatchGuid,
            importBatchGuidRecordIndex: importBatchRecord.importBatchGuid + ':' + importBatchRecord.recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        })
        .catch(function(error) {
            // We are noop-ing the error here. This audit isn't required. We will still have the audit
            // log of when the record is actually processed. We don't want the request to fail because
            // of the audit log.
            console.error(error.message);
            return Promise.resolve();
        })
    })
    .then(function() {
        //console.log('Audit event submitted.');
        //console.log('Completed submitting for reprocessing, sending 200');
        res.status(200).send();
        return Promise.resolve();
    })
    .catch(function(error) { 
        //res.locals.redirectWithError(error.message);
        res.status(500).send('Unable to reprocess record: ' + error.message);
    })
});

router.post('/batch/:importBatchGuid/records/reprocess', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var records = _.compact(_.map(req.body.recordIndexes.toString().split(','), function(value) {
        var recordIndex = parseInt(_.trim(value));
        if(!isNaN(recordIndex)) {
            return {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            };
        }
        return null;
    }));
    
    var recordResults;
    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;
        if(importBatch.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        if(_.includes(['processing','pending_review','complete'], importBatch.batchStatus)) {
            return ImportBatchDAO.submitRecordsForProcessing(records);
        }
        else {
            return Promise.reject(new Error('Batch is not in correct status to process records.'));
        }
    })
    .then(function(recordResultsResult) {
        recordResults = recordResultsResult;

        return Promise.each(recordResults, function(result) {
            if(!result.error) {
                return ImportEventDAO.createEvent({
                    eventType: 'record_reprocess',
                    importBatchGuid: result.importBatchGuid,
                    importBatchRecordGuid: result.importBatchGuid,
                    importBatchGuidRecordIndex: result.importBatchGuid + ':' + result.recordIndex,
                    userName: req.orgUser.userName,
                    indexUserId: req.indexUserId,
                    orgUserId: req.orgUserId,
                    orgInternalName: req.session.org
                })
                .catch(function(error) {
                    // We are noop-ing the error here. This audit isn't required. We will still have the audit
                    // log of when the record is actually processed. We don't want the request to fail because
                    // of the audit log.
                    console.error(error.message);
                    return Promise.resolve();
                })
            }
            else {
                return Promise.resolve();
            }
        })

    })
    .then(function() {
        var errors = _.compact(_.map(recordResults, function(r) { 
            if(r.error) {
                return '(Record ' + r.recordIndex + ') ' + r.error.message; 
            }
            return null; 
        }));
        console.log('Error count: ' + errors.length);
        if(errors.length == 0) {
            res.locals.redirectWithSuccess('Records sent for processing.', '/collector/batch/'+importBatchGuid);
        }
        else {
            res.locals.redirectWithError('Not all records sent for processing: \n' + errors.join('\n'));
        }
    })
    .catch(function(error) { 
        res.locals.redirectWithError(error.message);
    })
});

router.post('/batch/:importBatchGuid/records/reprocess/incomplete', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;

    
    var incompleteRecords;
    var submitRecordResults;
    ImportBatchDAO.getBatchByGuid(importBatchGuid, false, true)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;

        if(importBatch.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        if(_.includes(['processing','pending_review','complete'], importBatch.batchStatus)) {
            incompleteRecords = _.filter(importBatch.records, function(r) { return _.includes(['pending_processing','pending_review','preparing_to_process'], r.recordStatus)});
            console.log('Submitting ' + incompleteRecords.length + ' incomplete records for processing.');
            return ImportBatchDAO.submitRecordsForProcessing(incompleteRecords);
        }
        else {
            return Promise.reject(new Error('Batch is not in correct status to process records.'));
        }
    })
    .then(function(recordResultsResult) {
        submitRecordResults = recordResultsResult;

        return Promise.map(submitRecordResults, function(result) {
            if(!result.error) {
                console.log('Submitting audit event for: ' + result.importBatchGuid + ':' + result.recordIndex)
                return ImportEventDAO.createEvent({
                    eventType: 'record_reprocess',
                    importBatchGuid: result.importBatchGuid,
                    importBatchRecordGuid: result.importBatchGuid,
                    importBatchGuidRecordIndex: result.importBatchGuid + ':' + result.recordIndex,
                    userName: req.orgUser.userName,
                    indexUserId: req.indexUserId,
                    orgUserId: req.orgUserId,
                    orgInternalName: req.session.org
                })
                .catch(function(error) {
                    // We are noop-ing the error here. This audit isn't required. We will still have the audit
                    // log of when the record is actually processed. We don't want the request to fail because
                    // of the audit log.
                    console.error(error.message);
                    return Promise.resolve();
                })
            }
            else {
                return Promise.resolve();
            }
        },{ concurrency: 50 })

    })
    .then(function() {
        var errors = _.compact(_.map(submitRecordResults, function(r) { 
            if(r.error) {
                return '(Record ' + r.recordIndex + ') ' + r.error.message; 
            }
            return null; 
        }));
        console.log('Error count: ' + errors.length);
        if(errors.length == 0) {
            res.locals.redirectWithSuccess('Records sent for processing.', '/collector/batch/'+importBatchGuid);
        }
        else {
            res.locals.redirectWithError('Not all records sent for processing: \n' + errors.join('\n'));
        }
    })
    .catch(function(error) { 
        res.locals.redirectWithError(error.message);
    })
});

router.post('/batch/:importBatchGuid/regenerate', 
            auth.ensureAuthenticatedOrg({roles:{some:['DATA_ENTRY_ADMIN','FAC_ADMIN','ORG_ADMIN']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    
    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;
        if(importBatch.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        return ImportBatchDAO.addBatchToProcessingStream(importBatchGuid);
    })
    .then(function() {
        res.locals.redirectWithSuccess('Batch sent for regeneration.', '/collector/batch/'+importBatchGuid);
    })
    .catch(function(error) { 
        res.locals.redirectWithError(error.message);
    })
});


router.post('/batch/:importBatchGuid/records/reprocess/all', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    
    var recordResults;
    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;
        if(importBatch.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        if(_.includes(['processing','pending_review','complete'], importBatch.batchStatus)) {
            return ImportBatchDAO.addBatchesToRecordReprocessorStream([importBatchGuid], req.orgUser.userName, req.orgUserId, req.indexUserId);
        }
        else {
            return Promise.reject(new Error('Batch is not in correct status to process records.'));
        }
    })
    .then(function() {
        res.locals.redirectWithSuccess('Batch sent for reprocessing.', '/collector/batch/'+importBatchGuid);
    })
    .catch(function(error) { 
        res.locals.redirectWithError(error.message);
    })
});


// Used by the form to discard a record.
router.post('/batch/:importBatchGuid/mergeRecords', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var recordIndexes = _.map(req.body.recordIndexes.toString().split(','), function(value) { return parseInt(_.trim(value)); });

    if(recordIndexes.length < 2) {
        req.flash('error', 'Unable to merge records, you must select at least two records.');
        res.redirect(req.get('Referrer') || ('/collector/batch/'+importBatchGuid));
        return;
    }

    var mergedRecord;
    var importBatch;
    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;
        if(importBatch.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        return ImportBatchDAO.mergePDFRecords(importBatchGuid, recordIndexes);
    })
    .then(function(mergedRecordResult) {
        mergedRecord = mergedRecordResult;
        return Promise.each(recordIndexes, function(recordIndex) {
            return discardRecord(req, importBatch.importBatchGuid, recordIndex, 'Merged into new record.');
        });
    })
    .then(function() {

        return ImportEventDAO.createEvent({
            eventType: 'batch_records_merged',
            importBatchGuid: importBatch.importBatchGuid,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org,
            eventData: {
                mergedIndexes: recordIndexes,
                newIndex: mergedRecord.recordIndex
            }
        });
    })
    .then(function() {
        req.flash('success', 'Records merged successfully.');
        res.redirect(req.get('Referrer') || ('/collector/batch/'+importBatchGuid));
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error.stack);
        res.status(400).send(error.message);
    });
});

function discardRecord(req, importBatchGuid, recordIndex, reason) {
    return ImportBatchDAO.discardRecord(importBatchGuid, recordIndex, reason)
    .then(function(discardedBatchRecord) {
        return ImportEventDAO.createEvent({
            eventType: 'record_discarded',
            importBatchGuid: discardedBatchRecord.importBatchGuid,
            importBatchRecordGuid: discardedBatchRecord.importBatchRecordGuid,
            importBatchGuidRecordIndex: discardedBatchRecord.importBatchGuid + ':' + discardedBatchRecord.recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        });
    });
}

// Used by the form to unignore a record.
router.post('/batch/record/:importBatchGuid/:recordIndex(\\d+)/unignore.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var recordIndex = parseInt(req.params.recordIndex);

    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        if(importBatchResult.orgInternalName != req.session.org) {
            return Promise.reject(new Error('Unable to unignore batch record, not authorized.'));
        }
        else {
            return ImportBatchDAO.unignoreRecord(importBatchGuid, recordIndex);
        }
    })
    .then(function(ignoredBatchRecord) {
        return ImportEventDAO.createEvent({
            eventType: 'record_unignored',
            importBatchGuid: ignoredBatchRecord.importBatchGuid,
            importBatchRecordGuid: ignoredBatchRecord.importBatchRecordGuid,
            importBatchGuidRecordIndex: ignoredBatchRecord.importBatchGuid + ':' + ignoredBatchRecord.recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        });
    })
    .then(function() {
        res.status(200).send();
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error);
        res.status(400).send(error.message);
    });
});

// Used by the form to ignore a record.
router.post('/batch/record/:importBatchGuid/:recordIndex(\\d+)/ignore.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var recordIndex = parseInt(req.params.recordIndex);

    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        if(importBatchResult.orgInternalName != req.session.org) {
            return Promise.reject(new Error('Unable to ignore batch record, not authorized.'));
        }
        else {
            return ImportBatchDAO.ignoreRecord(importBatchGuid, recordIndex);
        }
    })
    .then(function(ignoredBatchRecord) {
        return ImportEventDAO.createEvent({
            eventType: 'record_ignored',
            importBatchGuid: ignoredBatchRecord.importBatchGuid,
            importBatchRecordGuid: ignoredBatchRecord.importBatchRecordGuid,
            importBatchGuidRecordIndex: ignoredBatchRecord.importBatchGuid + ':' + ignoredBatchRecord.recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        });
    })
    .then(function() {
        res.status(200).send();
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error);
        res.status(400).send(error.message);
    });
});

// Used by the form to discard a batch.
router.post('/batch/:importBatchGuid/discard.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['IMPORT_BATCH:DISCARD']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var reason = req.body && req.body.reason ? req.body.reason.toString() : null;

    if(!reason) {
        res.status(400).send('Must specify a reason to discard a record.');
    }
    
    ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        if(importBatchResult.orgInternalName != req.session.org) {
            return Promise.reject(new Error('Unable to discard batch, not authorized.'));
        }
        else {
            return ImportBatchDAO.discardBatch(importBatchGuid, reason)
        }
    })
    .then(function() {
        return ImportEventDAO.createEvent({
            eventType: 'batch_discarded',
            importBatchGuid: importBatchGuid,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        });
    })
    .then(function() {
        res.status(200).send();
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error);
        res.status(400).send(error.message);
    });
});

router.get('/batch/:importBatchGuid/openNextRecordForDataEntry', 
           auth.ensureAuthenticatedOrg({permissions:{some:['IMPORT_BATCH:READ_ALL','IMPORT_BATCH:READ_ASSIGNED']}}), 
function(req, res, next) {
    var importBatchGuid = req.params.importBatchGuid;
    var batch = ImportBatchDAO.getBatchByGuid(importBatchGuid, false, true, false)
        .then(function(importBatch) {

            if(importBatch.orgInternalName != req.session.org) {
                res.redirect('/user/restricted');
                return;
            }

            var fromRecord = req.query.fromRecord;
            var sortedRecords = _.sortBy(importBatch.records, 'recordOrder');
            // If a fromRecord is specified, let's attempt to find it in the list of records
            // and only go to next record from this one.
            var fromIndex = 0;
            if(fromRecord) {
                fromIndex = _.findIndex(sortedRecords, {importBatchRecordGuid:fromRecord}) + 1;
            }

            // I was using the fromIndex on _.find, but it wasn't working. So now we just drop the first N records and
            // search the resulting array.
            var nextImportBatchRecord = _.find(_.drop(sortedRecords,fromIndex), {recordStatus:'pending_data_entry'});
            if(!nextImportBatchRecord)
                res.redirect('/collector/batch/'+importBatchGuid);
            else
                res.redirect('/collector/batch/record/'+importBatchGuid+'/'+nextImportBatchRecord.recordIndex+'/dataEntry');
        })
        .catch(function(error) {
            console.error('Unable to go to next record: ' + error.message);
            console.log(error);
            res.redirect('/collector/batch/'+importBatchGuid);
        })
});

router.get('/batch/record/:importBatchGuid/:recordIndex(\\d+)/dataEntry', 
           auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res, next) {

    var externalWebForm;
    var importBatch;
    ImportBatchDAO.getBatchByGuid(req.params.importBatchGuid)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;

        if(importBatch.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        return Promise.all([
            FacilityDAO.getFacilities(req.session.org),
            ProviderDAO.getProvidersByFacility(req.session.org, importBatch.facilityId),
            ValueSetDAO.getValueSet(req.session.org, 'SurgeryLocations', 'Facility', importBatch.facilityId, true),
            ValueSetDAO.getValueSet(req.session.org, 'Complications','Global', null, true),
            ValueSetDAO.getValueSet(req.session.org, 'CaseDelayReasons','Global', null, true),
            ValueSetDAO.getValueSet(req.session.org, 'CaseCancellationReasons','Global', null, true),
            ImportBatchDAO.getBatchRecord(req.params.importBatchGuid, parseInt(req.params.recordIndex), true, true),
            ImportEventDAO.getEventsForRecord(req.params.importBatchGuid, req.params.recordIndex),
            ImportBatchDAO.getPreviousRecord(req.params.importBatchGuid, parseInt(req.params.recordIndex)),
            DataEntryFormDefinitionDAO.getFormDefinitionByName(req.session.org, importBatch.dataEntryFormDefinitionName)
        ]);
    })
    .spread(function(facilities, providers, surgeryLocationsValueSet, complicationsValueSet, delaysValueSet, cancellationsValueSet, importBatchRecord, recordEvents, previousRecord, dataEntryFormDefinition) {
        if(importBatch.batchStatus != 'processing' && importBatch.batchStatus != 'pending_review' && importBatch.batchStatus != 'complete') {
            return Promise.reject(new Error('This batch is not processing or pending review. You are unable to edit records for this batch.'));
        }
        var dsvFields = [];
        if(importBatchRecord.recordDataType == 'dsv_row') {
            var columns = importBatch.batchDataTypeOptions.columnNames || _.keys(importBatchRecord.dataEntryData.fieldValues); 
            if(columns) {
                console.log('Found columnNames...');
                var columnNames = columns;
                var columnTitles = importBatch.batchDataTypeOptions.columnTitles;

                for(var i = 0; i < columnNames.length; i++) {
                    console.log('- Adding dsv field: ' + columnNames[i]);
                    dsvFields.push({
                        columnName: columnNames[i],
                        columnTitle: columnTitles && columnTitles.length > i ? columnTitles[i] : columnNames[i],
                        originalValue: 'Unknown',
                        currentValue: importBatchRecord.dataEntryData.fieldValues[columnNames[i]]
                    });
                }
            }
        }

        // Right now we are hardcoding these values in, eventually we will move these to postgres
        // or dynamo.
        var facilityDataEntryFormSettings = {
            autoGenerateEncounterNumber: false
        };
        if( (req.session.org == 'aeaw2052' && importBatch.facilityId == 2) || 
            (req.session.org == 'uapi2030' && importBatch.facilityId == 36) || 
            (req.session.org == 'gotn2027' && _.includes([1,2,3], importBatch.facilityId)) || 
            (req.session.org == 'macd2041' && _.includes([63,15,16,45,39,46], importBatch.facilityId)) || 
            (req.session.org == 'asef2065' && importBatch.facilityId == 2) ||
            (req.session.org == 'gcsa2053') ||
            (req.session.org == 'pams2002' && _.includes([42,67,87], importBatch.facilityId)) || 
            (req.session.org == 'rcas2082' && _.includes([2,3,4], importBatch.facilityId)) ||
            (req.session.org == 'mtas2080' && importBatch.facilityId == 2)
          ) {
            facilityDataEntryFormSettings.autoGenerateEncounterNumber = true;
        }

        renderData = {
            facilities: facilities,
            providers: providers,
            importBatch: importBatch,
            importBatchRecord: importBatchRecord,
            recordEvents: recordEvents,
            previousRecord: previousRecord,
            dsvFields: dsvFields,
            facilityDataEntryFormSettings: facilityDataEntryFormSettings,
            dataEntryFormDefinition: dataEntryFormDefinition,
            surgeryLocationsValueSet: surgeryLocationsValueSet,
            complicationsValueSet: complicationsValueSet,
            delaysValueSet: delaysValueSet,
            cancellationsValueSet: cancellationsValueSet
        };

        var openedEvent = {
            eventType: 'record_opened',
            importBatchGuid: importBatchRecord.importBatchGuid,
            importBatchRecordGuid: importBatchRecord.importBatchRecordGuid,
            importBatchGuidRecordIndex: importBatchRecord.importBatchGuid + ':' + importBatchRecord.recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org
        };
        return ImportEventDAO.createEvent(openedEvent);
    })
    .then(function() {
        res.render('collector/recordDataEntry', renderData);
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error.stack);
        res.render('error',{error:error});
    })
});

module.exports = router;