var Promise = require('bluebird');
var uuid = require('uuid');
var winston = require('winston');
var _ = require('lodash');
var Joi = require('joi');
var ddb = require('../util/ddbUtil.js');
var s3 = require('../util/s3Util.js');
var AWS = require('aws-sdk');
var moment = require('moment');
var ImportBatchDAO = require('./ImportBatchDAO');
var ImportBatchTemplateDAO = require('./ImportBatchTemplateDAO');

/*
DDB_TABLE_IMPORT_FAX=collector.local.ddb.import_fax
DDB_TABLE_IMPORT_FAX_LINE_IDX=importFaxLineGuidReceivedAt-index

DDB_TABLE_IMPORT_FAX_LINE=collector.local.ddb.import_fax_line
DDB_TABLE_IMPORT_FAX_LINE_ORG_IDX=orgInternalName-index
*/

function validateFaxLine(faxLine) {

    var schema = {
        importFaxLineGuid: Joi.string().guid().required(),
        faxService: Joi.string().valid(['interfax']),
        orgInternalName: Joi.string().required(),
        faxLineName: Joi.string(),
        facilityId: Joi.number().integer(),
        generateBatchTemplateGuid: Joi.string().required(),
        phoneNumber: Joi.string(),
        createdAt: Joi.number().integer(),
        activeIndicator: Joi.boolean().required()
    }

    var validationResult = Joi.validate(faxLine, schema, {
        abortEarly: false,
        convert: false
    });

    if (validationResult.error) {
        var error = new Error('Fax line object is invalid.');
        error.validationError = validationResult.error;
        throw error;
    }
}

function validateFax(fax) {

    var schema = {
        importFaxGuid: Joi.string().guid().required(),
        importFaxLineGuid: Joi.string().guid().required(),
        generatedImportBatchGuid: Joi.string(),
        faxService: Joi.string().valid(['interfax']),
        interfaxData: Joi.object().keys({
            transactionId: Joi.string().required(),
            phoneNumber: Joi.string().required(),
            messageType: Joi.number().integer().required(),
            messageSize: Joi.number().integer().required(),
            remoteCsid: Joi.string().allow(null).optional(),
            pages: Joi.number().integer().required(),
            status: Joi.number().integer().required(),
            recordingDuration: Joi.number().integer().required(),
            receiveTime: Joi.string().required(),
            callerId: Joi.string().required()
        }),
        interfaxTransactionId: Joi.string().required(),
        pageCount: Joi.number().integer(),
        receivedAt: Joi.number().integer(),
        callerId: Joi.string().required(),
        createdAt: Joi.number().integer()
    }

    var validationResult = Joi.validate(fax, schema, {
        abortEarly: false,
        convert: false
    });

    if (validationResult.error) {
        var error = new Error('Fax is invalid.');
        console.log(validationResult);
        error.validationError = validationResult.error;
        throw error;
    }

}

function _createBatchForFax(faxLine, fax, faxPdf) {

    // create batch object
    // TODO: validate that the user being assigned to is a valid user...
    // call DAO to create the batch
    var importBatch = {
        batchName: 'Fax ' + moment(fax.receivedAt).format('MM-DD-YYYY hh:mm:ss A'),
        orgInternalName: faxLine.orgInternalName,
        batchSource: 'fax',
        batchSourceIds: {
            importFaxLineGuid: faxLine.importFaxLineGuid,
            importFaxGuid: fax.importFaxGuid
        },
        batchDataType: 'pdf',
        batchDataTypeOptions: {},
        requiresDataEntry: true,
        flowGuid: faxLine.faxLineConfig.generateBatchFlowGuid,
        dataEntryFormDefinitionName: 'PqrsReady',
        receivedAt: fax.receivedAt,
        processingType: 'flow',
        batchData: faxPdf
    };

    if(faxLine.facilityId != null) {
        importBatch.facilityId = faxLine.facilityId;
    }

    return ImportBatchDAO.createBatch(importBatch, null)
    .catch(function(error) {
        // We catch the error and move on. Creating batches from a fax will not kill this process. User
        // will not see a created batch and can manually trigger a batch creation.
        return Promise.resolve();
    })
}

function _createBatchForFaxWithTemplate(faxLine, fax, faxPdf) {

    // create batch object
    // TODO: validate that the user being assigned to is a valid user...
    // call DAO to create the batch
    //console.log('Creating batch for fax w/ template: ' + faxLine.generateBatchTemplateGuid);
    return ImportBatchTemplateDAO.getTemplate(faxLine.generateBatchTemplateGuid)
    .then(function(template) {

        //console.log('Retrieved template...');
        if(template.batchDataType != 'pdf') {
            // Error, we can't generate it via this template because it doesn't accept PDFs.
            console.error('This template does not accept PDFs.');
            return Promise.resolve();
        }
        else if(!template.systemGlobal && template.orgInternalName != faxLine.orgInternalName) {
            // Error, this batch template is not associated with this org.
            console.error('This template does not belong to this org.');
            return Promise.resolve();
        }

        var importBatch = {
            batchName: 'Fax ' + moment(fax.receivedAt).format('MM-DD-YYYY hh:mm:ss A'),
            orgInternalName: faxLine.orgInternalName,
            batchSource: 'fax',
            batchSourceIds: {
                importFaxLineGuid: faxLine.importFaxLineGuid,
                importFaxGuid: fax.importFaxGuid
            },
            batchTemplateGuid: faxLine.generateBatchTemplateGuid,
            batchDataType: 'pdf',
            batchDataTypeOptions: template.batchDataTypeOptions,
            requiresDataEntry: template.requiresDataEntry,
            flowGuid: template.flowScriptGuid,
            dataEntryFormDefinitionName: template.dataEntryFormDefinitionName,
            receivedAt: fax.receivedAt,
            processingType: 'flow',
            batchData: faxPdf
        };

        if(faxLine.facilityId != null) {
            importBatch.facilityId = faxLine.facilityId;
        }

        //console.log('Creating batch.');

        return ImportBatchDAO.createBatch(importBatch, template);
    })
    .catch(function(error) {
        // We catch the error and move on. Creating batches from a fax will not kill this process. User
        // will not see a created batch and can manually trigger a batch creation.
        console.error('Unable to generate batch: ' + error.message);
        console.error(error.stack);
        return Promise.resolve();
    })
}

function createBatchForFax(faxLine, fax, faxPdf) {
    
    var createBatchPromise;
    var createdBatch;

    if(faxLine.generateBatchTemplateGuid) {
        createBatchPromise = _createBatchForFaxWithTemplate(faxLine, fax, faxPdf);
    }
    else if(faxLine.faxLineConfig.generateBatchFlowGuid) {
        createBatchPromise = _createBatchForFax(faxLine, fax, faxPdf);
    }
    else {
        return Promise.resolve(null);
    }


    return createBatchPromise
    .then(function(createdBatchResult) {
        createdBatch = createdBatchResult;
        if(createdBatch) {
            return setCreatedBatchForFax(fax.importFaxGuid, createdBatch.importBatchGuid);
        }
        else {
            return Promise.resolve(null);
        }
    })
    .then(function() {
        return Promise.resolve(createdBatch);
    })
}

function createFaxForLine(importFaxLineGuid, fax, faxPdf, generateBatchConfig) {
    fax.importFaxGuid = uuid.v4();
    fax.createdAt = Date.now();

    var faxLine;
    return getFaxLine(importFaxLineGuid)
    .then(function(faxLineResult) {
        faxLine = faxLineResult;
        console.log('Looked up existing fax line: ');
        console.log(faxLine);
        if(!faxLine || !faxLine.activeIndicator) {
            return Promise.reject(new Error('Unable to create faxes for this fax line. Fax line doesn\'t exist or is inactive.'));
        }

        fax.importFaxLineGuid = faxLine.importFaxLineGuid;
        validateFax(fax);

        return ddb.putUnique(process.env.DDB_TABLE_IMPORT_FAX, fax, "importFaxGuid");
    })
    .then(function() {
        return s3.putObjectUnique(process.env.S3_IMPORT_FAX_PDF, fax.importFaxGuid, faxPdf);
    })
    .then(function() {
        return createBatchForFax(faxLine, fax, faxPdf);
    })
    .then(function() {
        return Promise.resolve(fax);
    });
}

function getFaxPdf(importFaxGuid) {
    return s3.getObjectBody(process.env.S3_IMPORT_FAX_PDF, importFaxGuid)
    .catch(function(error) {
        if(error.code == 'NoSuchKey') {
            return Promise.reject(new Error('Unable to find PDF for this record.'));
        }
        else {
            return Promise.reject(error);
        }
    })
}

function getFax(importFaxGuid, withFaxLine) {
    var fax;
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: process.env.DDB_TABLE_IMPORT_FAX,
            KeyConditionExpression: "importFaxGuid = :importFaxGuid",
            ExpressionAttributeValues: {
                ":importFaxGuid": importFaxGuid
            }
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items[0]);
        });
    })
    .then(function(faxResult) {
        fax = faxResult;
        if(withFaxLine) {
            return getFaxLine(faxResult.importFaxLineGuid);
        }
        else {
            return Promise.resolve(null);
        }
    })
    .then(function(faxLineResult) {
        fax.faxLine = faxLineResult;
        return Promise.resolve(fax);
    })
}

function getFaxByInterfaxId(interfaxTransactionId) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: process.env.DDB_TABLE_IMPORT_FAX,
            IndexName: "interfaxTransactionId-index",
            KeyConditionExpression: "interfaxTransactionId = :interfaxTransactionId",
            ExpressionAttributeValues: {
                ":interfaxTransactionId": interfaxTransactionId
            },
            ProjectionExpression: "importFaxGuid, interfaxTransactionId, generatedImportBatchGuids"
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items[0]);
        });
    });
}

function getFaxesForLine(importFaxLineGuid) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: process.env.DDB_TABLE_IMPORT_FAX,
            IndexName: process.env.DDB_TABLE_IMPORT_FAX_LINE_IDX,
            KeyConditionExpression: "importFaxLineGuid = :importFaxLineGuid",
            ExpressionAttributeValues: {
                ":importFaxLineGuid": importFaxLineGuid
            }
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items);
        });
    });
}

function getFaxLine(importFaxLineGuid) {
    var faxLine;
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: process.env.DDB_TABLE_IMPORT_FAX_LINE,
            KeyConditionExpression: "importFaxLineGuid = :importFaxLineGuid",
            ExpressionAttributeValues: {
                ":importFaxLineGuid": importFaxLineGuid
            }
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            if (err) 
                reject(err);
            else if(data.Items.length != 1) 
                reject(new Error('Fax line does not exist.'));
            else 
                resolve(data.Items[0]);
        });
    })
    .then(function(faxLineResult) {
        faxLine = faxLineResult;
        return decryptFaxLineConfig(faxLine.faxLineConfigCipher);
    })
    .then(function(faxLineConfig) {
        faxLine.faxLineConfig = faxLineConfig;
        return Promise.resolve(faxLine);
    })
}

function getFaxLinesForOrg(orgInternalName) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: process.env.DDB_TABLE_IMPORT_FAX_LINE,
            IndexName: process.env.DDB_TABLE_IMPORT_FAX_LINE_ORG_IDX,
            KeyConditionExpression: "orgInternalName = :orgInternalName",
            ExpressionAttributeValues: {
                ":orgInternalName": orgInternalName
            }
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items);
        });
    });
}

function getAllFaxLines() {
    return ddb.scanAll(process.env.DDB_TABLE_IMPORT_FAX_LINE);
}

function createFaxLine(orgInternalName, facilityId, faxLineName, phoneNumber, generateBatchTemplateGuid, faxLineConfig) {

    var faxLine = {
      importFaxLineGuid: uuid.v4(),
      orgInternalName: orgInternalName,
      faxService: 'interfax',
      facilityId: facilityId,
      faxLineName: faxLineName,
      generateBatchTemplateGuid: generateBatchTemplateGuid,
      phoneNumber: phoneNumber,
      createdAt: Date.now(),
      activeIndicator: true
    };

    try {
        validateFaxLine(faxLine);
    }
    catch(error) {
        return Promise.reject(error);
    }

    return ddb.putUnique(process.env.DDB_TABLE_IMPORT_FAX_LINE, faxLine, "importFaxLineGuid")
    .then(function() {
        return updateFaxLineConfig(faxLine.importFaxLineGuid, faxLineConfig);
    })
    .then(function() {
        faxLine.faxLineConfig = faxLineConfig;
        return Promise.resolve(faxLine);
    });
}

function encryptFaxLineConfig(faxLineConfig) {
    return new Promise(function(resolve, reject) {
        
        if( !faxLineConfig ) {
            resolve(null);
            return;
        }
        
        var params = {
            KeyId: 'alias/collector/'+process.env.FLOW_ENV+'/faxLineConfig',
            Plaintext: JSON.stringify(faxLineConfig)
        };
        
        var kms = new AWS.KMS({region:"us-east-1"});
        kms.encrypt(params, function(err, data) {
            if (err) 
                reject(err); // an error occurred
            else     
                resolve(data.CiphertextBlob.toString('base64'));
        });
    });
}


function decryptFaxLineConfig(faxLineConfigCipher) {
    return new Promise(function(resolve, reject) {
        
        if( !faxLineConfigCipher ) {
            resolve({});
            return;
        }
        
        var params = {
            CiphertextBlob: new Buffer(faxLineConfigCipher, 'base64')
        };
        
        var kms = new AWS.KMS({region:"us-east-1"});
        kms.decrypt(params, function(err, data) {
            
            if (err) { 
                reject(err); // an error occurred
            }
            else {
                var faxLineConfig = {};     
                var jsonString = data.Plaintext.toString();
                if(!jsonString)
                    return {};
                    
                try {
                    faxLineConfig = JSON.parse(jsonString); 
                }
                catch(error) {
                    faxLineConfig = {};
                }
                
                resolve(faxLineConfig);
            }
        });
    });
}

function updateFaxLine(importFaxLineGuid, faxLine) {
    
    return encryptFaxLineConfig(faxLine.faxLineConfig)
    .then(function(faxLineConfigCipher) {
        return new Promise(function(resolve, reject) {
            var params = {
                TableName: process.env.DDB_TABLE_IMPORT_FAX_LINE,
                Key: {
                    importFaxLineGuid: importFaxLineGuid
                },
                UpdateExpression: 'set faxLineConfigCipher = :faxLineConfigCipher,'
                                    + 'facilityId = :facilityId,'
                                    + 'phoneNumber = :phoneNumber,'
                                    + 'faxLineName = :faxLineName,'
                                    + 'generateBatchTemplateGuid = :generateBatchTemplateGuid,'
                                    + 'lastUpdatedAt = :now',
                ExpressionAttributeValues: {
                    ':faxLineConfigCipher': faxLineConfigCipher,
                    ':facilityId': faxLine.facilityId,
                    ':phoneNumber': faxLine.phoneNumber,
                    ':faxLineName': faxLine.faxLineName,
                    ':generateBatchTemplateGuid': faxLine.generateBatchTemplateGuid,
                    ':now': Date.now()
                }
            };

            var docClient = ddb.createDocClient();
            docClient.update(params, function(err, data) {
                if (err) reject(err);
                else resolve(importFaxLineGuid);
            });
        });    
    });
}

function setCreatedBatchForFax(importFaxGuid, importBatchGuid) {
    return new Promise(function(resolve, reject) {
        var docClient = ddb.createDocClient();
        var params = {
            TableName: process.env.DDB_TABLE_IMPORT_FAX,
            Key: {
                importFaxGuid: importFaxGuid
            },
            UpdateExpression: 'add generatedImportBatchGuids :importBatchGuids set lastUpdatedAt = :now',
            ExpressionAttributeValues: {
                ':importBatchGuids': docClient.createSet([importBatchGuid]),
                ':now': Date.now()
            }
        };

        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importFaxGuid);
        });
    });    
}

function updateFaxLineConfig(importFaxLineGuid, faxLineConfig) {
    
    return encryptFaxLineConfig(faxLineConfig)
    .then(function(faxLineConfigCipher) {
        return new Promise(function(resolve, reject) {
            var params = {
                TableName: process.env.DDB_TABLE_IMPORT_FAX_LINE,
                Key: {
                    importFaxLineGuid: importFaxLineGuid
                },
                UpdateExpression: 'set faxLineConfigCipher = :faxLineConfigCipher, lastUpdatedAt = :now',
                ExpressionAttributeValues: {
                    ':faxLineConfigCipher': faxLineConfigCipher,
                    ':now': Date.now()
                }
            };

            var docClient = ddb.createDocClient();
            docClient.update(params, function(err, data) {
                if (err) reject(err);
                else resolve(importFaxLineGuid);
            });
        });    
    });
}

module.exports = {
    createFaxLine: createFaxLine,
    createFaxForLine: createFaxForLine,
    createBatchForFax: createBatchForFax,
    getFaxLinesForOrg: getFaxLinesForOrg,
    getFaxLine: getFaxLine,
    getFaxesForLine: getFaxesForLine,
    getFax: getFax,
    getFaxPdf: getFaxPdf,
    updateFaxLine: updateFaxLine,
    getAllFaxLines: getAllFaxLines,
    getFaxByInterfaxId: getFaxByInterfaxId
};