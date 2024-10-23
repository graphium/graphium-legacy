var express = require('express');
var auth = require('../util/authMiddleware');
var router = express.Router();
var ImportBatchDAO = require('@common/lib/dao/ImportBatchDAO.js');
var multer = require('multer');
var autoReap = require('multer-autoreap');
var upload = multer()
var templateHelpers = require('../util/templateHelpers');
var roleGroups = require('../util/roleGroups');
var _ = require('lodash');
var OrgUserDAO = require('@common/lib/dao/org/OrgUserDAO.js');
var FacilityDAO = require('@common/lib/dao/org/FacilityDAO.js');
var ProviderDAO = require('@common/lib/dao/org/ProviderDAO.js');
var ImportEventDAO = require('@common/lib/dao/ImportEventDAO.js');
var FtpSiteDAO = require('@common/lib/dao/FtpSiteDAO');
var FlowDAO = require('@common/lib/dao/FlowDAO.js');
var ImportBatchTemplateDAO = require('@common/lib/dao/ImportBatchTemplateDAO.js')
var Promise = require('bluebird');
var moment = require('moment');
var InboundMessageInstanceDAO = require('@common/lib/dao/InboundMessageInstanceDAO.js');
var fileType = require('file-type');
var AWS = require('aws-sdk');

/* GET user profile. */
router.get('/connections', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    Promise.all([
        FacilityDAO.getFacilities(req.session.org),
        ImportBatchTemplateDAO.getTemplatesForOrg(req.session.org),
        FtpSiteDAO.getFtpSitesForOrg(req.session.org)
    ])
    .spread(function(facilities, templates, ftpSites) {
        res.render('orgSettings/ftp/connections', {
            facilities: facilities,
            templates: templates,
            ftpSites: ftpSites
        })
    })
});

function splitAndCleanList(list) {
    if(list) {
        return _.map(_.split(list,','), _.trim);
    }
    return [];
}

router.post('/connections', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    var ftpSite = {
        orgInternalName: req.session.org,
        ftpSiteName: req.body.ftpSiteName,
        folder: req.body.folder,
        fileFilter: req.body.fileFilter,
        ftpProtocol: req.body.ftpProtocol,
        ftpSiteConfig: {
            ftpUsername: req.body.ftpUsername,
            ftpPassword: req.body.ftpPassword,
            ftpHost: req.body.ftpHost
        },
        generateBatchTemplateGuid: req.body.generateBatchTemplateGuid,
        activeIndicator: req.body.active == 'on'
    };

    if(req.body.facilityId) {
        ftpSite.facilityId = parseInt(req.body.facilityId);
    }
    if(req.body.ftpPort) {
        ftpSite.ftpSiteConfig.ftpPort = parseInt(req.body.ftpPort);
    }

    FtpSiteDAO.createFtpSite(ftpSite)
    .then(function(createdFtpSite) {
        res.redirect('/org/settings/ftp/connections');
    })
    .catch(function(error) {
        console.error('Unable to create FTP site: ' + error.message);
        console.error(error.stack);
        req.flash('error','Unable to create new FTP folder. ' + error.message);
        res.redirect('/org/settings/ftp/connections');
    })
});

router.post('/connections/:ftpSiteGuid/file/:ftpFileGuid/batch/generate',  auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {

    var ftpSiteGuid = req.params.ftpSiteGuid;
    var ftpFileGuid = req.params.ftpFileGuid;

    Promise.all([
        FtpSiteDAO.getFtpSite(ftpSiteGuid),
        FtpSiteDAO.getFtpFile(ftpFileGuid),
        FtpSiteDAO.getFileData(ftpFileGuid)
    ])
    .spread(function(ftpSite, ftpFile, ftpFileBuffer) {
        console.log('Retrieved FTP data.');
        
        if(ftpSite.orgInternalName != req.session.org) {
            return Promise.reject(new Error('Unable to generate batch, incorrect organization.'));
        }

        if(ftpFile.ftpSiteGuid != ftpSite.ftpSiteGuid) {
            return Promise.reject(new Error('File not belong to the specified batch.'));
        }

        console.log('Creating batch for FTP file.');
        return FtpSiteDAO.createBatchForFile(ftpSite, ftpFile, ftpFileBuffer);
    })
    .then(function(batch) {
        console.log('Batch created for FTP file.');
        console.log(batch);
        res.locals.redirectWithSuccess('Successfully created batch.');
    })
    .catch(function(error) {
        res.locals.redirectWithError(error);
    });
});

// /collector/ftp/connection/#{file.ftpSiteGuid}/file/#{file.ftpFileGuid}
router.get('/connection/:ftpSiteGuid/file/:ftpFileGuid', 
           auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    console.log('-------- GETTING FILE');
    var ftpFile;
    return Promise.all([
        FtpSiteDAO.getFtpFile(req.params.ftpFileGuid, true)
    ])
    .spread(function(ftpFileResult) {
        ftpFile = ftpFileResult;

        if(ftpFile.ftpSite.ftpSiteGuid != req.params.ftpSiteGuid) {
            return Promise.reject(new Error('Invalid request, invalid FTP site ID.'));
        }

        if(ftpFile.ftpSite.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        return FtpSiteDAO.getFileData(ftpFile.ftpFileGuid);
    })
    .then(function(ftpFileData) {

        if(!ftpFileData || ftpFileData.length == 0) {
            return Promise.reject(new Error('Invalid file, unable to view file.'));
        }

        var ft = fileType(ftpFileData.slice(0,262));        
        res.writeHead(200, {
            'Content-Type': ft.mime,
            'Content-Disposition': 'inline; filename=' + (ftpFile.fileName || ftpFile.ftpFileGuid),
            'Content-Length': ftpFileData.length
        });
        res.end(ftpFileData);
    })
    .catch(function(error) {
        req.flash('error', error.message);
        res.redirect(req.get('Referrer') || ('/org/settings/ftp/connections/'+req.params.ftpSiteGuid));
    })
});

router.get('/connections/:ftpSiteGuid', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    Promise.all([
        FacilityDAO.getFacilities(req.session.org),
        ImportBatchTemplateDAO.getTemplatesForOrg(req.session.org),
        FtpSiteDAO.getFtpSite(req.params.ftpSiteGuid),
        FtpSiteDAO.getFilesForSite(req.params.ftpSiteGuid)
    ])
    .spread(function(facilities, templates, ftpSite, ftpSiteFiles) {
        if(ftpSite.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        res.render('orgSettings/ftp/connection', {
            facilities: facilities,
            ftpSite: ftpSite,
            templates: templates,
            ftpSiteFiles: ftpSiteFiles
        })
    })
});

// I love you StackOverflow http://stackoverflow.com/questions/10834796/validate-that-a-string-is-a-positive-integer
function isPositiveInteger(n) {
    return n >>> 0 === parseFloat(n);
}

router.post('/connections/:ftpSiteGuid', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {

    FtpSiteDAO.getFtpSite(req.params.ftpSiteGuid)
    .then(function(existingFtpSite) {

        if(existingFtpSite.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }
        var ftpSite = {
            orgInternalName: req.session.org,
            ftpSiteName: req.body.ftpSiteName,
            folder: req.body.folder,
            fileFilter: req.body.fileFilter,
            ftpProtocol: req.body.ftpProtocol,
            ftpSiteConfig: {
                ftpUsername: req.body.ftpUsername,
                ftpPassword: req.body.ftpPassword,
                ftpHost: req.body.ftpHost
            },
            generateBatchTemplateGuid: req.body.generateBatchTemplateGuid,
            activeIndicator: req.body.active == 'on'
        };

        if(isPositiveInteger(req.body.facilityId)) {
            ftpSite.facilityId = parseInt(req.body.facilityId);
        }
        if(req.body.ftpPort) {
            ftpSite.ftpSiteConfig.ftpPort = parseInt(req.body.ftpPort);
        }

        return FtpSiteDAO.updateFtpSite(req.params.ftpSiteGuid, ftpSite);
    })
    .then(function(updatedSite) {
        res.redirect('/org/settings/ftp/connections/'+req.params.ftpSiteGuid);
    })
    .catch(function(error) {
        console.error('Unable to update FTP: ' + error.message);
        console.error(error.stack);
        req.flash('error',error.message);
        res.redirect('/org/settings/ftp/connections/');
    })

});

router.post('/connections/:ftpSiteGuid/rescan.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {

    FtpSiteDAO.getFtpSite(req.params.ftpSiteGuid)
    .then(function(existingFtpSite) {

        if(existingFtpSite.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }

        var scanMessages = [{
            ftpSiteGuid: existingFtpSite.ftpSiteGuid,
            lastScannedAt: existingFtpSite.lastScannedAt
        }];
        return addMessagesToKinesisStream(EnvironmentConfig.getProperty('collector-v1','KS_FTP_SCAN'), scanMessages, 'ftpSiteGuid');
    })
    .then(function() {
        res.send(200);
    })
    .catch(function(error) {
        res.status(500).send(error.message);
    })

});

var addMessagesToKinesisStream = function(kinesisStreamName, messages, partitionKeyPropertyName) {
    return new Promise(function(resolve,reject) {
        
        if(!messages || messages.length == 0) {
            resolve();
            return;
        }
        
        var params = {
            Records: [],
            StreamName: kinesisStreamName
        };
        
        for( var i = 0; i < messages.length; i++ ) {
            var message = messages[i];
            params.Records.push({
                Data: JSON.stringify(message),
                PartitionKey: partitionKeyPropertyName && message.hasOwnProperty(partitionKeyPropertyName) ? message[partitionKeyPropertyName] : 'default'
            });
        }
        
        var kinesis = new AWS.Kinesis({region:"us-east-1"});
        kinesis.putRecords(params, function(err, data) {
            if (err) {
                reject(new Error(err))
            }
            else {
                resolve()
            }
        });
    });
}


module.exports = router;