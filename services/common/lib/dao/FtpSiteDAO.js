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
var crypto = require('crypto');
var fileType = require('file-type');
var anymatch = require('anymatch');

function validateFtpSite(ftpSite) {

  var schema = {
    ftpSiteGuid: Joi.string().guid().required(),
    folder: Joi.string(),
    ftpSiteName: Joi.string().required(),
    fileFilter: Joi.string(),
    ftpProtocol: Joi.string().valid(['sftp', 'ftps']).required(),
    ftpSiteConfig: Joi.object().keys({
      ftpHost: Joi.string().optional(),
      ftpPort: Joi.number().integer().optional(),
      ftpUsername: Joi.string().optional(),
      ftpPassword: Joi.string().optional(),
      generateBatchFlowGuid: Joi.forbidden()
    }),
    generateBatchTemplateGuid: Joi.string().required(),
    orgInternalName: Joi.string().required(),
    facilityId: Joi.number().integer(),
    activeIndicator: Joi.boolean().required(),
    lastUpdatedAt: Joi.number().integer(),
    lastScannedAt: Joi.number().integer(),
    createdAt: Joi.number().integer()
  }

  var validationResult = Joi.validate(ftpSite, schema, {
    abortEarly: false,
    convert: false
  });

  if (validationResult.error) {
    var error = new Error('FTP site is invalid.');
    error.validationError = validationResult.error;
    throw error;
  }
}

function validateFtpFile(ftpFile) {

  var schema = {
    ftpFileGuid: Joi.string().guid().required(),
    ftpSiteGuid: Joi.string().guid().required(),
    fileName: Joi.string().required(),
    fileStatus: Joi.string().valid(['duplicate_checksum','downloaded','filtered']).required(),
    fullPath: Joi.string().required(),
    checksum: Joi.string().required(),
    fileSize: Joi.number(),
    generatedImportBatchGuid: Joi.string().guid(),
    createdAt: Joi.number().integer()
  }

  var validationResult = Joi.validate(ftpFile, schema, {
    abortEarly: false,
    convert: false
  });

  if (validationResult.error) {
    var error = new Error('FTP file is invalid.');
    error.validationError = validationResult.error;
    throw error;
  }

}

function createBatchForFile(ftpSite, ftpFile, ftpFileData) {
    var generateBatchPromise;
    if(ftpSite.generateBatchTemplateGuid) {

      generateBatchPromise = ImportBatchTemplateDAO.getTemplate(ftpSite.generateBatchTemplateGuid)
      .then(function(template) {
        if(!template.systemGlobal && template.orgInternalName != ftpSite.orgInternalName) {
          return Promise.reject(new Error('Unable to generate batch for file. Template does not belong to this organization.'));
        }

        if(template.batchDataType == 'pdf') {
          var ft = fileType(ftpFileData.slice(0,262));
          if(!ft || ft.ext != 'pdf') {
            return Promise.reject('Unable to create batch, file is not a PDF.');
          }
        }
        else { // must be a DSV
          ftpFileData = ftpFileData.toString();
        }

        // create batch object
        // TODO: validate that the user being assigned to is a valid user...
        // call DAO to create the batch
        var importBatch = {
            batchName: 'FTP File ' + ftpFile.fileName,
            orgInternalName: ftpSite.orgInternalName,
            batchSource: 'ftp',
            batchSourceIds: {
              ftpSiteGuid: ftpSite.ftpSiteGuid,
              ftpFileGuid: ftpFile.ftpFileGuid
            },
            batchDataType: template.batchDataType,
            batchDataTypeOptions: template.batchDataTypeOptions,
            requiresDataEntry: template.requiresDataEntry,
            flowGuid: template.flowScriptGuid,
            dataEntryFormDefinitionName: template.dataEntryFormDefinitionName,
            receivedAt: Date.now(), // Probably at some point need to get this data from the FTP file.
            processingType: 'flow',
            batchData: ftpFileData
        };

        if(ftpSite.facilityId != null) {
            importBatch.facilityId = ftpSite.facilityId;
        }

        return ImportBatchDAO.createBatch(importBatch, template);
      });
    }
    else if(ftpSite.ftpSiteConfig && ftpSite.ftpSiteConfig.generateBatchFlowGuid) {
      
      var ft = fileType(ftpFileData.slice(0,262));
      if(!ft || ft.ext != 'pdf') {
        return Promise.reject('Unable to create batch, file is not a PDF.');
      }

      // create batch object
      // TODO: validate that the user being assigned to is a valid user...
      // call DAO to create the batch
      var importBatch = {
          batchName: 'FTP File ' + ftpFile.fileName,
          orgInternalName: ftpSite.orgInternalName,
          batchSource: 'ftp',
          batchSourceIds: {
            ftpSiteGuid: ftpSite.ftpSiteGuid,
            ftpFileGuid: ftpFile.ftpFileGuid
          },
          batchDataType: 'pdf',
          batchDataTypeOptions: {},
          requiresDataEntry: true,
          flowGuid: ftpSite.ftpSiteConfig.generateBatchFlowGuid,
          dataEntryFormDefinitionName: 'PqrsReady',
          receivedAt: Date.now(), // Probably at some point need to get this data from the FTP file.
          processingType: 'flow',
          batchData: ftpFileData
      };

      if(ftpSite.facilityId != null) {
          importBatch.facilityId = ftpSite.facilityId;
      }

      generateBatchPromise = ImportBatchDAO.createBatch(importBatch, null);
    }
    else {
      return Promise.reject(new Error('Unable to generate batch for file. No flow or template is defined.'));
    }

    var generatedBatch;
    return generateBatchPromise.then(function(generateBatchResult) {
      generatedBatch = generateBatchResult;
      return setCreatedBatchForFile(ftpFile.ftpFileGuid, generatedBatch.importBatchGuid);
    })
    .then(function() {
      return Promise.resolve(generatedBatch);
    })
}

function createFileForFtpSite(ftpSiteGuid, ftpFile, ftpFileDataBuffer, tl) {

  ftpFile.ftpSiteGuid = ftpSiteGuid;
  ftpFile.ftpFileGuid = uuid.v4();
  ftpFile.createdAt = Date.now();
  ftpFile.fileSize = ftpFileDataBuffer.length;
  ftpFile.checksum = crypto.createHash('md5').update(ftpFileDataBuffer).digest("hex");

  var ftpSite;
  var matchesChecksum;

  var duplicateFileNameError = new Error('Ignoring file, it matches the file name of another file and is likely a duplicate.'); 
  duplicateFileNameError.errorCode = 'FTP_DUP_FILE_NAME';

  if(tl) tl.logInfo('CRTE_FILE_FOR_STE_START','Creating FTP file.');

  return Promise.all([getFtpSite(ftpSiteGuid), getFilesByChecksum(ftpSiteGuid, ftpFile.checksum), getFilesByName(ftpSiteGuid, ftpFile.fileName)])
  .spread(function(ftpSiteResult, filesMatchingChecksum, filesMatchingName) {

    if(tl) tl.logInfo('CRTE_FILE_GET_DATA','Retrieved ftp site, files by checksum and by name.', {
      generateBatchFlowGuid: ftpSiteResult && ftpSiteResult.ftpSiteConfig ? ftpSiteResult.ftpSiteConfig.generateBatchFlowGuid : null
    });
    
    ftpSite = ftpSiteResult;
    if (!ftpSite || !ftpSite.activeIndicator) {
      return Promise.reject(new Error('Unable to add new files for this FTP site. FTP site does not exist for ID or is not active.'));
    }

    if(filesMatchingName && filesMatchingName.length > 0) {
      var duplicateFileNameError = new Error('Ignoring file, it matches the file name of another file and is likely a duplicate.'); 
      duplicateFileNameError.errorCode = 'FTP_DUP_FILE_NAME';
      tl.log('DUP_FILE_NAME', 'File name matches existing file name, ignoring file.');
      return Promise.reject(duplicateFileNameError);
    }
    else if(ftpSite.fileFilter && !anymatch([ftpSite.fileFilter], ftpFile.fileName)) {
      if(tl) tl.logInfo('FILTERED','File filtered.');
      ftpFile.fileStatus = 'filtered';
    }
    else if(filesMatchingChecksum && filesMatchingChecksum.length > 0) {
      if(tl) tl.logInfo('CHECKSUM_MATCHED','File matches existing checksum.');
      ftpFile.fileStatus = 'duplicate_checksum';
    }
    else {
      if(tl) tl.logInfo('DOWNLOADED','Proceeding to import file, file downloaded.');
      ftpFile.fileStatus = 'downloaded';
    }

    ftpFile.ftpSiteGuid = ftpSite.ftpSiteGuid;
    validateFtpFile(ftpFile);

    if(tl) tl.logInfo('PERS_DDB','Creating FTP file in DDB.');
    return ddb.putUnique(process.env.DDB_TABLE_FTP_FILE, ftpFile, "ftpFileGuid");
  })
  .then(function () {
    if(ftpFile.fileStatus == 'downloaded') {
      if(tl) tl.logInfo('PERS_S3','Persisting file data to S3.');
      return s3.putObjectUnique(process.env.S3_FTP_FILE_DATA, ftpFile.ftpFileGuid, ftpFileDataBuffer);
    }
    else {
      return Promise.resolve();
    }
  })
  .then(function() {
    if(ftpFile.fileStatus == 'downloaded' && (
          (ftpSite.ftpSiteConfig && ftpSite.ftpSiteConfig.generateBatchFlowGuid) || 
          (ftpSite.generateBatchTemplate && ftpSite.generateBatchTemplate.flowScriptGuid)
      )) {

        if(tl) tl.logInfo('GEN_BTCH_START','Beginning batch generation for FTP File.');

        try {
          return createBatchForFile(ftpSite, ftpFile, ftpFileDataBuffer)
          .catch(function(error) {
            if(tl) tl.logError('GEN_BTCH_ERR','Beginning batch generation for FTP File.', {
              batchGenerationErrorMessage: error.message,
              batchGenerationErrorStack: error.stack,
              batchGenerationError: error
            });
            ftpFile.batchGenerated = false;
            ftpFile.batchGenerationErrorMessage = error.message;
            ftpFile.batchGenerationErrorStack = error.stack;
            return Promise.resolve();  
          });
        }
        catch(error) {
          if(tl) tl.logError('CRT_BTCH_ERR','Unable to execute createBatchForFile promise.', {
            batchGenerationErrorMessage: error.message,
            batchGenerationErrorStack: error.stack,
            batchGenerationError: error
          });
          ftpFile.batchGenerated = false;
          ftpFile.batchGenerationErrorMessage = error.message;
          ftpFile.batchGenerationErrorStack = error.stack;
          return Promise.resolve(null);
        }
    }
    else {
        ftpFile.batchGenerated = true;
        return Promise.resolve(null);
    }
  })
  .then(function () {
    return Promise.resolve(ftpFile);
  });
}

function getFileData(ftpFileGuid) {
  return s3.getObjectBody(process.env.S3_FTP_FILE_DATA, ftpFileGuid)
    .catch(function (error) {
      if (error.code == 'NoSuchKey') {
        return Promise.reject(new Error('Unable to find data for this file.'));
      }
      else {
        return Promise.reject(error);
      }
    })
}

function getFtpFile(ftpFileGuid, withFtpSite) {
  var ftpFile;
  return new Promise(function (resolve, reject) {
    var params = {
      TableName: process.env.DDB_TABLE_FTP_FILE,
      KeyConditionExpression: "ftpFileGuid = :ftpFileGuid",
      ExpressionAttributeValues: {
        ":ftpFileGuid": ftpFileGuid
      }
    };

    var docClient = ddb.createDocClient();
    docClient.query(params, function (err, data) {
      if (err) reject(err);
      else resolve(data.Items[0]);
    });
  })
    .then(function (ftpFileResult) {
      ftpFile = ftpFileResult;
      if (withFtpSite) {
        return getFtpSite(ftpFile.ftpSiteGuid);
      }
      else {
        return Promise.resolve(null);
      }
    })
    .then(function (ftpSiteResult) {
      ftpFile.ftpSite = ftpSiteResult;
      return Promise.resolve(ftpFile);
    })
}

function getFilesForSite(ftpSiteGuid) {
  return ddb.queryAll(
    process.env.DDB_TABLE_FTP_FILE,
    process.env.DDB_TABLE_FTP_FILE_SITE_IDX,
    "ftpSiteGuid = :ftpSiteGuid and createdAt > :zero",
    {
        ":ftpSiteGuid": ftpSiteGuid,
        ":zero": 0
    },
    false
  );
}

//DDB_TABLE_FTP_FILE_NAME_IDX=ftpFileName-index
//DDB_TABLE_FTP_CHECKSUM_IDX=checksum-index

function getFilesByChecksum(ftpSiteGuid, checksum) {
  return new Promise(function (resolve, reject) {
    var params = {
      TableName: process.env.DDB_TABLE_FTP_FILE,
      IndexName: process.env.DDB_TABLE_FTP_CHECKSUM_IDX,
      KeyConditionExpression: "checksum = :checksum",
      FilterExpression: "ftpSiteGuid = :ftpSiteGuid",
      ExpressionAttributeValues: {
        ":checksum": checksum,
        ":ftpSiteGuid": ftpSiteGuid
      }
    };

    var docClient = ddb.createDocClient();
    docClient.query(params, function (err, data) {
      if (err) reject(err);
      else resolve(data.Items);
    });
  });
}

function getFilesByName(ftpSiteGuid, fileName) {
  return new Promise(function (resolve, reject) {
    var params = {
      TableName: process.env.DDB_TABLE_FTP_FILE,
      IndexName: process.env.DDB_TABLE_FTP_FILE_NAME_IDX,
      KeyConditionExpression: "fileName = :fileName",
      FilterExpression: "ftpSiteGuid = :ftpSiteGuid",
      ExpressionAttributeValues: {
        ":fileName": fileName,
        ":ftpSiteGuid": ftpSiteGuid
      }
    };

    var docClient = ddb.createDocClient();
    docClient.query(params, function (err, data) {
      if (err) reject(err);
      else resolve(data.Items);
    });
  });
}

function getFtpSite(ftpSiteGuid) {
  var ftpSite;
  return new Promise(function (resolve, reject) {
    var params = {
      TableName: process.env.DDB_TABLE_FTP_SITE,
      KeyConditionExpression: "ftpSiteGuid = :ftpSiteGuid",
      ExpressionAttributeValues: {
        ":ftpSiteGuid": ftpSiteGuid
      }
    };

    var docClient = ddb.createDocClient();
    docClient.query(params, function (err, data) {
      if (err) reject(err);
      else resolve(data.Items[0]);
    });
  })
  .then(function (ftpSiteResult) {
    ftpSite = ftpSiteResult;
    return decryptFtpSiteConfig(ftpSite.ftpSiteConfigCipher);
  })
  .then(function (ftpSiteConfig) {
    ftpSite.ftpSiteConfig = ftpSiteConfig;

    if(ftpSite.generateBatchTemplateGuid) {
      return ImportBatchTemplateDAO.getTemplate(ftpSite.generateBatchTemplateGuid);
    }
    else {
      return Promise.resolve(null);
    }
  })
  .then(function(importBatchTemplateResult) {
    ftpSite.generateBatchTemplate = importBatchTemplateResult;
    return Promise.resolve(ftpSite);
  });
}

function getFtpSitesForOrg(orgInternalName) {
  return new Promise(function (resolve, reject) {
    var params = {
      TableName: process.env.DDB_TABLE_FTP_SITE,
      IndexName: process.env.DDB_TABLE_FTP_SITE_ORG_IDX,
      KeyConditionExpression: "orgInternalName = :orgInternalName",
      ExpressionAttributeValues: {
        ":orgInternalName": orgInternalName
      }
    };

    var docClient = ddb.createDocClient();
    docClient.query(params, function (err, data) {
      if (err) reject(err);
      else resolve(data.Items);
    });
  }).then(function(ftpSites) {

    return Promise.map(ftpSites, function(ftpSite) {
      return decryptFtpSiteConfig(ftpSite.ftpSiteConfigCipher)
      .then(function (ftpSiteConfig) {
        ftpSite.ftpSiteConfig = ftpSiteConfig;
        if(ftpSite.generateBatchTemplateGuid) {
          return ImportBatchTemplateDAO.getTemplate(ftpSite.generateBatchTemplateGuid);
        }
        return Promise.resolve(null);
      })
      .then(function(importBatchTemplate) {
        ftpSite.generateBatchTemplate = importBatchTemplate;
        return ftpSite;
      });
    });
  });
}

function getAllFtpSites(orgInternalName) {
  return ddb.scanAll(process.env.DDB_TABLE_FTP_SITE);
}

function createFtpSite(ftpSite) {

  ftpSite.ftpSiteGuid = uuid.v4();
  ftpSite.createdAt = Date.now();
  ftpSite.lastUpdatedAt = Date.now();

  try {
    validateFtpSite(ftpSite);
  }
  catch (error) {
    return Promise.reject(error);
  }

  var ftpSiteConfig = ftpSite.ftpSiteConfig;
  delete ftpSite.ftpSiteConfig;

  return ImportBatchTemplateDAO.getTemplate(ftpSite.generateBatchTemplateGuid)
  .then(function(template) {
    if(!template.systemGlobal && template.orgInternalName != ftpSite.orgInternalName) {
      return Promise.reject(new Error('Unable to update FTP connection, batch template does not belong to this organization.'));
    }
    else {
      return ddb.putUnique(process.env.DDB_TABLE_FTP_SITE, ftpSite, "ftpSiteGuid")
    }
  })
  .then(function () {
    return updateFtpSiteConfig(ftpSite.ftpSiteGuid, ftpSiteConfig);
  })
  .then(function () {
    ftpSite.ftpSiteConfig = ftpSiteConfig;
    return Promise.resolve(ftpSite);
  });
}

function encryptFtpSiteConfig(ftpSiteConfig) {
  return new Promise(function (resolve, reject) {

    if (!ftpSiteConfig) {
      resolve(null);
      return;
    }

    var params = {
      KeyId: 'alias/collector/' + process.env.FLOW_ENV + '/ftpSiteConfig',
      Plaintext: JSON.stringify(ftpSiteConfig)
    };

    var kms = new AWS.KMS({ region: "us-east-1" });
    kms.encrypt(params, function (err, data) {
      if (err)
        reject(err); // an error occurred
      else
        resolve(data.CiphertextBlob.toString('base64'));
    });
  });
}


function decryptFtpSiteConfig(ftpSiteConfigCipher) {
  return new Promise(function (resolve, reject) {

    if (!ftpSiteConfigCipher) {
      resolve({});
      return;
    }

    var params = {
      CiphertextBlob: new Buffer(ftpSiteConfigCipher, 'base64')
    };

    var kms = new AWS.KMS({ region: "us-east-1" });
    kms.decrypt(params, function (err, data) {

      if (err) {
        reject(err); // an error occurred
      }
      else {
        var ftpSiteConfig = {};
        var jsonString = data.Plaintext.toString();
        if (!jsonString)
          return {};

        try {
          ftpSiteConfig = JSON.parse(jsonString);
        }
        catch (error) {
          ftpSiteConfig = {};
        }

        resolve(ftpSiteConfig);
      }
    });
  });
}

function updateFtpSite(ftpSiteGuid, ftpSite) {

  return ImportBatchTemplateDAO.getTemplate(ftpSite.generateBatchTemplateGuid)
  .then(function(template) {
    if(!template.systemGlobal && template.orgInternalName != ftpSite.orgInternalName) {
      return Promise.reject(new Error('Unable to update FTP connection, batch template does not belong to this organization.'));
    }
    else {
      return encryptFtpSiteConfig(ftpSite.ftpSiteConfig)
    }
  })
  .then(function (ftpSiteConfigCipher) {
    return new Promise(function (resolve, reject) {
      var params = {
        TableName: process.env.DDB_TABLE_FTP_SITE,
        Key: {
          ftpSiteGuid: ftpSiteGuid
        },
        UpdateExpression: 'set ftpSiteConfigCipher = :ftpSiteConfigCipher,'
          + 'facilityId = :facilityId,'
          + 'generateBatchTemplateGuid = :generateBatchTemplateGuid,'
          + 'folder = :folder,'
          + 'ftpSiteName = :ftpSiteName,'
          + 'fileFilter = :fileFilter,'
          + 'ftpProtocol = :ftpProtocol,'
          + 'lastUpdatedAt = :now,'
          + 'activeIndicator = :activeIndicator',
        ExpressionAttributeValues: {
          ':ftpSiteConfigCipher': ftpSiteConfigCipher,
          ':facilityId': ftpSite.facilityId || null,
          ':folder': ftpSite.folder || null,
          ':ftpSiteName': ftpSite.ftpSiteName,
          ':fileFilter': ftpSite.fileFilter || null,
          ':ftpProtocol': ftpSite.ftpProtocol,
          ':activeIndicator': ftpSite.activeIndicator,
          ':generateBatchTemplateGuid': ftpSite.generateBatchTemplateGuid,
          ':now': Date.now()
        },
        ConditionExpression: 'attribute_exists(ftpSiteGuid)'
      };

      var docClient = ddb.createDocClient();
      docClient.update(params, function (err, data) {
        if (err) {
          console.error('=========== REJECTING DOCUMENT UPDATE');
          console.error(err.message); 
          reject(err);
        }
        else resolve(ftpSiteGuid);
      });
    });
  });
}

function indicateFtpSiteScanned(ftpSiteGuid) {
  return new Promise(function (resolve, reject) {
    var params = {
      TableName: process.env.DDB_TABLE_FTP_SITE,
      Key: {
        ftpSiteGuid: ftpSiteGuid
      },
      UpdateExpression: 'set lastUpdatedAt = :now, lastScannedAt = :now',
      ExpressionAttributeValues: {
        ':now': Date.now()
      },
      ConditionExpression: 'attribute_exists(ftpSiteGuid)'
    };

    var docClient = ddb.createDocClient();
    docClient.update(params, function (err, data) {
      if (err) reject(err)
      else resolve(ftpSiteGuid);
    });
  });
}

function setCreatedBatchForFile(ftpFileGuid, importBatchGuid) {
  if(!ftpFileGuid) {
    return Promise.reject(new Error('Unable to update created batch for FTP file. File ID not set.'))
  }

  if(!importBatchGuid) {
    return Promise.reject(new Error('Unable to update created batch for FTP file. Import batch ID not set.'))
  }

  return new Promise(function (resolve, reject) {

    var docClient = ddb.createDocClient();
    var params = {
      TableName: process.env.DDB_TABLE_FTP_FILE,
      Key: {
        ftpFileGuid: ftpFileGuid
      },
      UpdateExpression: 'add generatedImportBatchGuids :importBatchGuids set lastUpdatedAt = :now',
      ExpressionAttributeValues: {
        ':importBatchGuids': docClient.createSet([importBatchGuid]),
        ':now': Date.now()
      }
    };

    docClient.update(params, function (err, data) {
      if (err) reject(err);
      else resolve(ftpFileGuid);
    });
  });
}

function updateFtpSiteConfig(ftpSiteGuid, ftpSiteConfig) {

  return encryptFtpSiteConfig(ftpSiteConfig)
    .then(function (ftpSiteConfigCipher) {
      return new Promise(function (resolve, reject) {
        var params = {
          TableName: process.env.DDB_TABLE_FTP_SITE,
          Key: {
            ftpSiteGuid: ftpSiteGuid
          },
          UpdateExpression: 'set ftpSiteConfigCipher = :ftpSiteConfigCipher, lastUpdatedAt = :now',
          ExpressionAttributeValues: {
            ':ftpSiteConfigCipher': ftpSiteConfigCipher,
            ':now': Date.now()
          }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function (err, data) {
          if (err) reject(err);
          else resolve(ftpSiteGuid);
        });
      });
    });
}

function getAllUnscannedConnections(since) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: process.env.DDB_TABLE_FTP_SITE,
            FilterExpression: "(attribute_not_exists(lastScannedAt) or attribute_type(lastScannedAt, :nullType) or lastUpdatedAt < :since) and activeIndicator = :active",
            ExpressionAttributeValues: {
                ":since": since,
                ":nullType": "NULL",
                ":active": true
            }
        };

        var allItems = [];
        var getResults = function(lastEvaluatedKey) {
            if(lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }

            var docClient = ddb.createDocClient();
            docClient.scan(params, function(err, data) {
                if (err) {
                    reject(err);
                    return;
                }

                allItems = allItems.concat(data.Items);
                if(data.LastEvaluatedKey) {
                    getResults(data.LastEvaluatedKey);
                }
                else {
                    resolve(allItems);
                }
            });
        }

        getResults();
    });
}

module.exports = {
  createFileForFtpSite: createFileForFtpSite,
  createBatchForFile: createBatchForFile,
  getFileData: getFileData,
  getFtpFile: getFtpFile,
  getFilesForSite: getFilesForSite,
  getFilesByName: getFilesByName,
  getFtpSite: getFtpSite,
  getFtpSitesForOrg: getFtpSitesForOrg,
  createFtpSite: createFtpSite,
  updateFtpSite: updateFtpSite,
  setCreatedBatchForFile: setCreatedBatchForFile,
  getAllUnscannedConnections: getAllUnscannedConnections,
  getFilesByChecksum: getFilesByChecksum,
  indicateFtpSiteScanned: indicateFtpSiteScanned,
  getAllFtpSites: getAllFtpSites
};