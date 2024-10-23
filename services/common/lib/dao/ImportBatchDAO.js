var Promise = require('bluebird');
var uuid = require('uuid');
var AWS = require('aws-sdk');
var winston = require('winston');
var _ = require('lodash');
var flat = require('flat');
var Joi = require('joi');
var csv = require('csv');
var moment = require('moment');

var s3 = require('../util/s3Util.js');
var ddb = require('../util/ddbUtil.js');
var pdfImageGenerator = require('../util/pdfImageGenerator.js');
var ImportBatchTemplateDAO = require('./ImportBatchTemplateDAO');
var HagyParser = require('../util/HagyParser').default;
var HcaAdvantxParser = require('../util/HcaAdvantxParser').default;
var MedaxionBillingParser = require('../util/MedaxionBillingParser').default;
var EnvironmentConfig = require('../config/EnvironmentConfig').EnvironmentConfig;

/*
DDB_TABLE_IMPORT_BATCH
DDB_TABLE_IMPORT_BATCH_CHECKED_OUT_BY_IDX
DDB_TABLE_IMPORT_BATCH_STATUS_IDX

DDB_TABLE_IMPORT_BATCH_RECORD
DDB_TABLE_IMPORT_BATCH_RECORD_IMPORT_BATCH_GUID_IDX
DDB_TABLE_IMPORT_BATCH_RECORD_STATUS_IDX

S3_IMPORT_BATCH_DATA
S3_IMPORT_BATCH_RECORD_DATA
S3_IMPORT_BATCH_RECORD_DATA_ENTRY
*/



var saveImportBatchToS3 = function(importBatchGuid, importBatchData) {
    return s3.putObjectUnique(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_DATA'), importBatchGuid, importBatchData);
}

var saveImportBatchRecordToS3 = function(importBatchRecordGuid, importBatchRecordData) {
    return s3.putObjectUnique(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_DATA'), importBatchRecordGuid, importBatchRecordData);
}

var saveImportBatchRecordDataEntryToS3 = function(importBatchGuid, recordIndex, dataEntryData) {
    var key = importBatchGuid + ':' + recordIndex;
    return s3.putObject(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_DATA_ENTRY'), key, dataEntryData);
}

var createImportBatchDdb = function(importBatch) {
    // We make sure and don't persist the batchData object to ddb.
    var cleanedDdbInstance = _.clone(importBatch);
    delete cleanedDdbInstance.batchData;

    return ddb.putUnique(EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'), cleanedDdbInstance, "importBatchGuid");
}

var createImportBatchRecordDdb = function(importBatchRecord) {
    // We make sure and don't persist the batchData object to ddb.
    var cleanedDdbInstance = _.clone(importBatchRecord);
    delete cleanedDdbInstance.recordData;

    return ddb.putUnique(EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'), cleanedDdbInstance, "importBatchRecordGuid");
}

var getImportBatchDdb = function(importBatchGuid) {
    return ddb.getConsistent(EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'), "importBatchGuid", importBatchGuid);
}

var retrieveImportBatchDataFromS3 = function(importBatchGuid) {
    return s3.getObjectBody(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_DATA'), importBatchGuid);
}

var retrieveImportBatchRecordDataFromS3 = function(importBatchRecordGuid) {
    return s3.getObjectBody(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_DATA'), importBatchRecordGuid);
}

var retrieveImportBatchRecordDataEntryDataFromS3 = function(importBatchGuid, recordIndex) {
    var key = importBatchGuid + ':' + recordIndex;
    return s3.getObjectBody(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_DATA_ENTRY'), key)
    .then(function(importBatchRecordDataEntryData) {
        return Promise.resolve(JSON.parse(importBatchRecordDataEntryData));
    })
}

function generateImportBatchRecord(batch, recordDataType, recordData, recordOrder) {
    var record = {
        importBatchRecordGuid: uuid.v4(),
        importBatchGuid: batch.importBatchGuid,
        orgInternalName: batch.orgInternalName,
        facilityId: batch.facilityId,
        recordDataType: recordDataType,
        recordData: recordData,
        recordIndex: recordOrder,
        recordOrder: recordOrder,
        recordStatus: batch.requiresDataEntry ? 'pending_data_entry' : 'pending_processing',
        notes: [],
        dataEntryBy: [],
        dataEntryData: {
            fieldValues: {},
            dataEntryErrorFields: [],
            invalidFields: [],
            recordData: {}
        }
    }

    var schema = {
        importBatchRecordGuid: Joi.string().required(),
        searchKey: Joi.string().optional(),
        importBatchGuid: Joi.string().required(),
        orgInternalName: Joi.string().required(),
        facilityId: Joi.number().integer(),
        recordDataType: Joi.string().valid(['dsv_row', 'pdf_bitmap_pages', 'external_web_form', 'hagy_record', 'hca_advantx_record', 'medaxion_record']),
        recordData: Joi.when('recordDataType', {
                is: 'dsv_row',
                then: Joi.object({
                    headers: Joi.array().allow(null).required(),
                    data: Joi.array().required()
                }).required()
            })
            .when('recordDataType', {
                is: 'pdf_bitmap_pages',
                then: Joi.array().items(Joi.object({
                    bitmapBase64: Joi.string().required(),
                    encoding: Joi.string().valid(['png'])
                })).required()
            })
            .when('recordDataType', {
                is: 'hagy_record',
                then: Joi.object({
                    recordSet: Joi.object().required()
                }).required()
            })
            .when('recordDataType', {
                is: 'hca_advantx_record',
                then: Joi.object({
                    recordSet: Joi.object().required()
                }).required()
            })
            .when('recordDataType', {
                is: 'medaxion_record',
                then: Joi.object({
                    recordSet: Joi.object().required()
                }).required()
            }),
        recordIndex: Joi.number().integer().required(),
        recordOrder: Joi.number().required(),
        recordStatus: Joi.string().valid(['pending_data_entry', 'pending_processing']),
        notes: Joi.array().length(0),
        dataEntryBy: Joi.array().length(0),
        dataEntryData: Joi.object().keys({
            fieldValues: Joi.object().max(0),
            dataEntryErrorFields: Joi.array().length(0),
            invalidFields: Joi.array().length(0),
            recordData: Joi.object().max(0)
        }).max(4)
    }

    var validationResult = Joi.validate(record, schema, {
        abortEarly: false,
        convert: false
    });
    if (validationResult.error) {
        var error = new Error('Unable to create ImportBatchRecord object, invalid parameters.');
        console.log(validationResult);
        error['validationError'] = validationResult.error;
        throw error;
    }

    if(record.recordDataType == 'dsv_row') {
        for(var i = 0; i < record.recordData.data.length; i++) {
            var fieldName = record.recordData.headers && record.recordData.headers.length > i ? record.recordData.headers[i] : i.toString();
            var fieldValue = record.recordData.data[i];
            record.dataEntryData.fieldValues[fieldName] = fieldValue;
            record.dataEntryData.recordData[fieldName] = fieldValue;
        }
    }
    else if(record.recordDataType == 'hagy_record') {
        let hagyRecordSet = _.cloneDeep(record.recordData.recordSet);
        delete hagyRecordSet.sources;
        let flattenedHagy = flat(record.recordData.recordSet);
        record.dataEntryData.fieldValues = flattenedHagy;
        record.dataEntryData.recordData = flattenedHagy;
    }
    else if(record.recordDataType == 'hca_advantx_record') {
        let hcaAdvantxRecordSet = _.cloneDeep(record.recordData.recordSet);
        delete hcaAdvantxRecordSet.sources;
        let flattenedHcaAdvantx = flat(record.recordData.recordSet);
        record.dataEntryData.fieldValues = flattenedHcaAdvantx;
        record.dataEntryData.recordData = flattenedHcaAdvantx;
    }
    else if(record.recordDataType == 'medaxion_record') {
        let medaxionRecordSet = _.cloneDeep(record.recordData.recordSet);
        delete medaxionRecordSet.sources;
        let flattenedMedaxion = flat(record.recordData.recordSet);
        record.dataEntryData.fieldValues = flattenedMedaxion;
        record.dataEntryData.recordData = flattenedMedaxion;
    }

    console.log('Generated record: ' + record.importBatchRecordGuid);

    return record;
}

function regenerateRecordImage(batchGuid, recordIndex) {
    var record;
    return getBatchByGuid(batchGuid,true,true,false)
    .then(function(batch) {
        record = _.find(batch.records, {recordIndex:recordIndex});

        if(!record) {
            return Promise.reject(new Error('Unable to generate page image, batch does not have a record with index ' + recordIndex  + '.'));
        }
        else if(batch.batchDataType != 'pdf') {
            return Promise.reject(new Error('Unable to generate page image, batch is not of type PDF.'));
        }
        else {
            return pdfImageGenerator.generateImages(batchGuid, batch.batchData, recordIndex, 1);
        }
    })
    .then(function(imageBuffers) {
        var pageData = [{
            bitmapBase64: imageBuffers[0].toString('base64'),
            encoding: 'png'
        }];

        return saveImportBatchRecordToS3(record.importBatchRecordGuid, JSON.stringify(pageData))
        .then(function() {
            return Promise.resolve(pageData);
        })
        .catch(function(error) {
            return Promise.resolve(pageData);
        })
    })
}

function generateRecordsFromPdf(batch, startingIndex) {

    //console.log('Parsing records from PDF...');
    var records = [];
    return pdfImageGenerator.generateImages(batch.importBatchGuid, batch.batchData, startingIndex)
        .then(function(imageBuffers) {
            //console.log('Retrieved pages from PDF...');
            for (var i = 0; i < imageBuffers.length; i++) {
                var pageData = {
                    bitmapBase64: imageBuffers[i].toString('base64'),
                    encoding: 'png'
                };
                records.push(generateImportBatchRecord(batch, 'pdf_bitmap_pages', [pageData], startingIndex+i));
            }

            return Promise.resolve(records);
        });
}


function generateRecordsFromHagy(batch, startingIndex) {
    //console.log('Parsing records from CSV...');
    return new Promise(function(resolve, reject) {
        let parser = new HagyParser();
        let recordSets = parser.parse(batch.batchData.toString());
        //console.log(JSON.stringify(recordSets,null,4));

        let records = [];
        let recordIndex = 0;
        for(let recordSet of recordSets) {
            //console.log('Generating import batch record for: ' + recordSet.patient.patientFirstName);
            if(recordIndex < startingIndex) {
                console.log('Skipping generating of record ' + recordIndex + '.');
            }
            else {
                records.push(generateImportBatchRecord(batch, 'hagy_record', { recordSet: recordSet }, recordIndex));
            }
            recordIndex++;
        }
        //console.log(records);
        resolve(records);
    });
}

function generateRecordsFromHcaAdvantx(batch, startingIndex) {
    //console.log('Parsing records from HCA Advantx...');
    return new Promise(function(resolve, reject) {
        let parser = new HcaAdvantxParser();
        let recordSets = parser.parse(batch.batchData.toString());
        //console.log(JSON.stringify(recordSets,null,4));

        let records = [];
        let recordIndex = 0;
        for(let recordSet of recordSets) {
            //console.log('Generating import batch record for: ' + recordSet.patient.patientFirstName);
            if(recordIndex < startingIndex) {
                console.log('Skipping generating of record ' + recordIndex + '.');
            }
            else {
                records.push(generateImportBatchRecord(batch, 'hca_advantx_record', { recordSet: recordSet }, recordIndex));
            }
            recordIndex++;
        }
        //console.log(records);
        resolve(records);
    });
}

function generateRecordsFromMedaxion(batch, startingIndex) {
    //console.log('Parsing records from Medaxion...');
    return new Promise(function (resolve, reject) {
        let parser = new MedaxionBillingParser();
        let recordSets = parser.parse(batch.batchData.toString());
        //console.log(JSON.stringify(recordSets,null,4));

        let records = [];
        let recordIndex = 0;
        for (let recordSet of recordSets) {
            if (recordIndex < startingIndex) {
                console.log('Skipping generating of record ' + recordIndex + '.');
            } else {
                records.push(
                    generateImportBatchRecord(batch, 'medaxion_record', { recordSet: recordSet }, recordIndex),
                );
            }
            recordIndex++;
        }
        //console.log(records);
        resolve(records);
    });
}

function generateRecordsFromDsv(batch) {
    //console.log('Parsing records from CSV...');
    return new Promise(function(resolve, reject) {
        var csvOptions = {};
        var hasHeader = false;

        if(batch.batchDataTypeOptions) {
            switch(batch.batchDataTypeOptions.delimiter) {
                case 'comma': csvOptions.delimiter = ','; break;
                case 'tab': csvOptions.delimiter = '\t'; break;
                case 'pipe': csvOptions.delimiter = '|'; csvOptions.relax = true; break;
                case 'colon': csvOptions.delimiter = ':'; break;
                default: csvOptions.delimiter = ',';
            }
            hasHeader = batch.batchDataTypeOptions.hasHeader;
            csvOptions.skip_empty_lines = batch.batchDataTypeOptions.skipEmptyLines === true;
            csvOptions.relax_column_count = batch.batchDataTypeOptions.relaxColumnCount === true;
            csvOptions.skip_lines_with_empty_values = batch.batchDataTypeOptions.skipLinesWithEmptyValues === true;
        }

        csv.parse(batch.batchData, csvOptions, function(err, data) {

            if (err) {
                //console.error('Unable to parse CSV: ' + err.message);
                reject(err);
                return;
            }

            if(_.isInteger(batch.batchDataTypeOptions.linesToSkip)) {
                var minimumArrayLength = batch.batchDataTypeOptions.linesToSkip + (hasHeader ? 1 : 0);
                if(data.length < minimumArrayLength) {
                    resolve([]);
                }
                else {
                    data.splice(0, batch.batchDataTypeOptions.linesToSkip);
                }
            }

            //console.log('Parsed CSV data, generating import records...');
            var records = [];
            var headers = [];
            if(hasHeader) {
                headers = data[0];
            }
            else if(batch.batchDataTypeOptions.columnNames) {
                headers = batch.batchDataTypeOptions.columnNames;
            }

            var startIndex = (hasHeader === true ? 1 : 0);
            for (var i = startIndex; i < data.length; i++) {
                var rowData = {
                    headers: headers,
                    data: data[i]
                }
                records.push(generateImportBatchRecord(batch, 'dsv_row', rowData, i));
            }

            resolve(records);
        });
    });
}

function createBatchRecord(importBatch, record) {
    var record;
    return _createBatchRecord(importBatch, record)
        .then(function(recordResult) {
            record = recordResult;
            return _updateBatchCounts(importBatch.importBatchGuid);
        })
        .then(function(importBatchGuid) {
            return Promise.resolve(record);
        })
}

function _createBatchRecord(importBatch, record) {

    record.importBatchRecordGuid = uuid.v4();
    record.importBatchGuid = importBatch.importBatchGuid;
    record.createdAt = new Date().getTime();
    record.lastUpdatedAt = new Date().getTime();
    record.dataEntryErrorFields = [];
    record.dataEntryInvalidFields = [];
    record.dataEntryDataIndicated = false;
    record.responsibleProviderIds = [];
    record.primaryResponsibleProviderId = null;
    record.notes = [];
    record.dataEntryBy = [];
    record.recordStatus = importBatch.requiresDataEntry ? 'pending_data_entry' : 'pending_processing';

    var initialDataEntryData = record.dataEntryData;
    delete record.dataEntryData;

    var schema = {
        importBatchRecordGuid: Joi.string().guid().required(),
        importBatchGuid: Joi.string().guid().required(),
        orgInternalName: Joi.string().required(),
        searchKey: Joi.string().optional(),
        facilityId: Joi.number().integer(),
        recordDataType: Joi.string().valid(['dsv_row', 'pdf_bitmap_pages','external_web_form','hagy_record','hca_advantx_record','medaxion_record']),
        dataEntryErrorFields: Joi.array().length(0),
        dataEntryInvalidFields: Joi.array().length(0),
        responsibleProviderIds: Joi.array().length(0),
        primaryResponsibleProviderId: Joi.number().allow(null).optional(),
        dataEntryDataIndicated: Joi.boolean().required(),
        recordData: Joi.when('recordDataType', {
                is: 'dsv_row',
                then: Joi.object({
                    headers: Joi.array(),
                    data: Joi.array()
                }).required()
            })
            .when('recordDataType', {
                is: 'pdf_bitmap_pages',
                then: Joi.array().items(Joi.object({
                    bitmapBase64: Joi.string().required(),
                    encoding: Joi.string().valid(['png'])
                })).required()
            })
            .when('recordDataType', {
                is: 'hagy_record',
                then: Joi.object({
                    recordSet: Joi.object().required()
                }).required()
            })
            .when('recordDataType', {
                is: 'hca_advantx_record',
                then: Joi.object({
                    recordSet: Joi.object().required()
                }).required()
            })
            .when('recordDataType', {
                is: 'medaxion_record',
                then: Joi.object({
                    recordSet: Joi.object().required()
                }).required()
            }),
        recordIndex: Joi.number().integer().required(),
        recordOrder: Joi.number().integer().required(),
        recordStatus: Joi.string().valid(['pending_data_entry', 'pending_processing']),
        discardReason: Joi.string().forbidden(),
        notes: Joi.array().length(0),
        dataEntryBy: Joi.array().length(0),
        createdAt: Joi.number().required(),
        lastUpdatedAt: Joi.number().required(),
        completedAt: Joi.number().forbidden()
    }

    var validationResult = Joi.validate(record, schema, {
        abortEarly: false,
        convert: false
    });
    if (validationResult.error) {
        //console.log(JSON.stringify(record,null,4));
        console.log(validationResult);
        var error = new Error('X Unable to persist object, not in correct format.');
        error.validationError = validationResult.error;
        return Promise.reject(error);
    }

    //console.log('Persisting import batch record in ddb...');
    return createImportBatchRecordDdb(record)
        .then(function() {
            //console.log('Record persisted in ddb, saving data to S3...');
            var encodedData = JSON.stringify(record.recordData, null, 4);

            //console.log('Encoded data for S3: ' + JSON.stringify(encodedData, null, 4));
            return Promise.all([saveImportBatchRecordToS3(record.importBatchRecordGuid, encodedData), saveImportBatchRecordDataEntryToS3(record.importBatchGuid, record.recordIndex, initialDataEntryData) ]);
        })
        .then(function(s3metadata) {
            return Promise.resolve(record);
        })
}

function mergePDFRecords(importBatchGuid, recordIndexes) {
    var importBatch;
    var recordsToBeMerged;

    return getBatchByGuid(importBatchGuid, false, true, true)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;
        if(importBatch.batchDataType != 'pdf') {
            return Promise.reject(new Error('Cannot merge records, this batch is not a PDF batch.'));
        }

        if(_.includes(['pending_generation','generating','generation_error'],importBatch.batchStatus)) {
            return Promise.reject(new Error('Cannot merge records in batch that is pending generation.'));
        }

        recordsToBeMerged = _.filter(importBatch.records, function(record) { return _.includes(recordIndexes, record.recordIndex) });

        if(!_.every(recordsToBeMerged, function(record) { return record.recordStatus == 'pending_data_entry'; })) {
            return Promise.reject(new Error('Cannot merge records, not all records are Pending Data Entry'));
        }

        var mergedImages = _.flatten(_.map(recordsToBeMerged, function(record) { return record.recordData; }));

        var newRecord = generateImportBatchRecord(importBatch, 'pdf_bitmap_pages', mergedImages, _.maxBy(importBatch.records,'recordIndex').recordIndex + 1);
        return createBatchRecord(importBatch, newRecord);
    })
    .then(function(newRecord) {
        return Promise.resolve(newRecord);
    });
}

function setBatchTemplate(importBatchGuid, template) {

    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            Key: {
                importBatchGuid: importBatchGuid
            },
            UpdateExpression: 'set batchTemplateGuid = :batchTemplateGuid, batchDataType = :batchDataType, ' +
                                  'batchDataTypeOptions = :batchDataTypeOptions, requiresDataEntry = :requiresDataEntry, ' +
                                  'flowGuid = :flowGuid, dataEntryFormDefinitionName = :dataEntryFormDefinitionName',
            ConditionExpression: 'attribute_exists(importBatchGuid)',
            ExpressionAttributeValues: {
                ':batchTemplateGuid': template.templateGuid,
                ':batchDataType': template.batchDataType,
                ':batchDataTypeOptions': template.batchDataTypeOptions,
                ':requiresDataEntry': template.requiresDataEntry,
                ':flowGuid': template.flowScriptGuid,
                ':dataEntryFormDefinitionName': template.dataEntryFormDefinitionName
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve();
        });
    });
}

function updateBatchTemplate(importBatchGuid, importBatchTemplateGuid) {
    var batch;
    var template;
    return new Promise.all([
        getBatchByGuid(importBatchGuid),
        ImportBatchTemplateDAO.getTemplate(importBatchTemplateGuid)
    ])
    .spread(function(batchResult, templateResult) {
        batch = batchResult;
        template = templateResult;

        if(!template.systemGlobal && batch.orgInternalName != template.orgInternalName) {
            return Promise.reject(new Error('Unable to assign batch to template, invalid template.'));
        }

        if(batch.batchDataType != 'pdf') {
            return Promise.reject(new Error('Cannot modify template for batches that are not generated from PDFs.'));
        }

        if(template.batchDataType != 'pdf') {
            return Promise.reject(new Error('Cannot change to a template that doesn\'t support PDFs'));
        }

        return setBatchTemplate( importBatchGuid, template );
    })
}

function createBatch(batch, template, bypassRecordGeneration, immediateRecordGeneration, skipProcessing) {
    batch = _.clone(batch);
    if (!batch.batchData)
        return Promise.reject(new Error('Batch contains no data, unable to store batch.'));

    batch.importBatchGuid = uuid.v4();
    batch.createdAt = new Date().getTime();
    batch.lastUpdatedAt = new Date().getTime();
    if(!batch.receivedAt) batch.receivedAt = batch.createdAt;
    batch.processingType = 'flow';
    batch.batchStatus = 'pending_generation';

    if(template && template.defaultAssigneeUserName)
        batch.assignedTo = template.defaultAssigneeUserName;

    if(template && !batch.batchTemplateGuid)
        batch.batchTemplateGuid = template.templateGuid;

    var schema = {
        batchName: Joi.string(),
        searchKey: Joi.string().optional(),
        orgInternalName: Joi.string().required(),
        facilityId: Joi.number().integer(),
        batchSource: Joi.string().valid(['fax', 'ftp', 'manual']),
        batchSourceIds:
            Joi.when('batchSource', { is: 'fax', then: Joi.object().keys({
                importFaxLineGuid: Joi.string().guid().required(),
                importFaxGuid: Joi.string().guid().required()
            })})
            .when('batchSource', { is: 'ftp', then: Joi.object().keys({
                ftpSiteGuid: Joi.string().guid().required(),
                ftpFileGuid: Joi.string().guid().required()
            })})
            .when('batchSource', { is: 'manual', then: Joi.object().keys({
                userName: Joi.string().required()
            })})
            .when('batchSource', { is: 'external_web_form', then: Joi.object().max(0) }),
        batchDataType: Joi.string().valid(['pdf', 'dsv', 'hagy', 'hcaAdvantx', 'medaxion']),
        requiresDataEntry: Joi.boolean().required(),
        assignedTo: Joi.string().allow(null),
        processingType: Joi.string().valid('flow'),
        flowGuid: Joi.string().guid().required(),
        batchTemplateGuid: Joi.string().guid().optional(),
        batchDataTypeOptions: Joi.when('batchDataType', {
            is:'dsv',
            then: Joi.object().required().keys({
                delimiter: Joi.string().valid(['tab','comma','pipe','colon']).required(),
                hasHeader: Joi.boolean().required(),
                columnNames: Joi.array().allow(null),
                columnTitles: Joi.array().allow(null),
                linesToSkip: Joi.number().integer().allow(null),
                skipEmptyLines: Joi.boolean(),
                skipLinesWithEmptyValues: Joi.boolean(),
                relaxColumnCount: Joi.boolean()
            }),
            otherwise: Joi.object().max(0)
        }),
        batchData: Joi.when('batchDataType', {
            is: 'pdf',
            then: Joi.binary().required()
        })
        .when('batchDataType', {
            is: 'dsv',
            then: Joi.string().required()
        })
        .when('batchDataType', {
            is: 'hagy',
            then: Joi.string().required()
        })
        .when('batchDataType', {
            is: 'hcaAdvantx',
            then: Joi.string().required()
        })
        .when('batchDataType', {
            is: 'medaxion',
            then: Joi.string().required()
        })
        .when('batchDataType', {
            is: 'none',
            then: Joi.allow(null)
        }),
        flowScriptGuid: Joi.string(),
        formDefinitionId: Joi.number().integer(),
        formDefinitionName: Joi.string(),
        formDefinitionVersion: Joi.number().integer(),
        importBatchGuid: Joi.string().required(),
        createdAt: Joi.number().required(),
        lastUpdatedAt: Joi.number().required(),
        receivedAt: Joi.number().required(),
        batchStatus: Joi.string().valid(['pending_generation']),
        dataEntryFormDefinitionName: Joi.string()
            .when('requiresDataEntry', { is: true, then: Joi.required(), otherwise: Joi.allow(null)}),
        // Empty
        discardReason: Joi.any().forbidden(),
        completedAt: Joi.any().forbidden()
    }

    var validationResult = Joi.validate(batch, schema, {
        abortEarly: false,
        convert: false
    });
    if (validationResult.error) {
        var error = new Error('Unable to persist object, not in correct format.');
        console.log(JSON.stringify(validationResult,null,4));
        error.validationError = validationResult.error;
        return Promise.reject(error);
    }

    console.log('Creating import batch...');
    return createImportBatchDdb(batch)
        .then(function(ddbImportBatch) {
            console.log('Batch created, saving batch data...');
            return saveImportBatchToS3(batch.importBatchGuid, batch.batchData);
        })
        .then(function() {
            console.log('Batch data saved, adding to stream for processing...');
            if(bypassRecordGeneration === true) {
                return Promise.resolve();
            }
            else if(immediateRecordGeneration === true) {
                return generateImportBatchRecords(batch.importBatchGuid, null, skipProcessing);
            }
            else {
                return addBatchToProcessingStream(batch.importBatchGuid);
            }
        })
        .then(function() {
            return Promise.resolve(batch);
        })
}


function generateImportBatchRecords(importBatchGuid, transactionLog, skipProcessing) {
    var parsedRecords;
    //console.log('Autogenerating batch records, parsing data...' + importBatch.batchDataType);

    var importBatchRecords;
    var importBatch;

    if(transactionLog) transactionLog.logInfo('IMPT_BTCH_DAO_GEN_RCRDS', 'Begin generating records.');

    return getBatchByGuid(importBatchGuid, true, true)
    .then(function(getBatchResult) {
        importBatch = getBatchResult;
        // We only allow batches to be processed if they are 'pending_generation', had a generation error, or
        // if the batch has been in 'generating' status for more than 10 minutes. Also, we allow batches in triage
        // that have 0 records be regenerated as well.
        console.log('Determining if batch can be generated again: ');
        console.log({pdfPageCount: importBatch.batchDataPdfPageCount, recordCount: importBatch.records.length, status: importBatch.batchStatus});
        if( (importBatch.batchDataType == 'pdf' && importBatch.batchDataPdfPageCount > importBatch.records.length) ||
            importBatch.batchStatus == 'pending_generation' || importBatch.batchStatus == 'generation_error' ||
           (importBatch.batchStatus == 'generating' && moment(importBatch.lastUpdatedAt).add(10, 'minutes').isBefore(moment()) ) ||
           (importBatch.batchStatus == 'triage' && importBatch.records && importBatch.records.length == 0) ) {
            if(transactionLog) transactionLog.logInfo('IMPT_BTCH_DAO_STATUS_RTRVD', 'Retrieved status, and in correct state.', { currentBatchStatus: importBatch.batchStatus });
            return indicateBatchGenerating(importBatch.importBatchGuid)
        }
        else {
            if(transactionLog) transactionLog.logError('IMPT_BTCH_DAO_INCRCT_STATUS', 'Batch not in correct status.');
            var error = new Error('Unable to generate records. Batch not in correct status. Current status: ' + importBatch.batchStatus + ' Last Updated: ' + importBatch.lastUpdatedAt);
            error.ignoreError = true;
            return Promise.reject(error);
        }
    })
    .then(function() {
        if(transactionLog) transactionLog.logInfo('GEN_RCRDS','Generating records for batch.', { batchDataLength: importBatch.batchData ? importBatch.batchData.length : -1 });
        if (importBatch.batchDataType == 'hagy') {
            var lastRecord = _.maxBy(importBatch.records,'recordIndex');
            var startingIndex = lastRecord ? lastRecord.recordIndex + 1 : 0;
            if(transactionLog) transactionLog.logInfo('GEN_HGY_RCRD','Generating records for HAGY batch.', {startingIndex: startingIndex});
            parsedRecords = generateRecordsFromHagy(importBatch, startingIndex);
        }
        else if (importBatch.batchDataType == 'hcaAdvantx') {
            var lastRecord = _.maxBy(importBatch.records,'recordIndex');
            var startingIndex = lastRecord ? lastRecord.recordIndex + 1 : 0;
            if(transactionLog) transactionLog.logInfo('GEN_ADVNTX_RCRD','Generating records for HCA Advantx batch.', {startingIndex: startingIndex});
            parsedRecords = generateRecordsFromHcaAdvantx(importBatch, startingIndex);
        }
        else if (importBatch.batchDataType == 'medaxion') {
            var lastRecord = _.maxBy(importBatch.records,'recordIndex');
            var startingIndex = lastRecord ? lastRecord.recordIndex + 1 : 0;
            if(transactionLog) transactionLog.logInfo('GEN_MEDAXION_RCRD','Generating records for Medaxion batch.', {startingIndex: startingIndex});
            parsedRecords = generateRecordsFromMedaxion(importBatch, startingIndex);
        }
        else if (importBatch.batchDataType == 'pdf') {
            // Just incase records already exist for this record, we go ahead and make the
            // start index the highest index. The generateRecordsFromPdf will not generate
            // any records if this number is >= the number of pages in the PDF.
            var lastRecord = _.maxBy(importBatch.records,'recordIndex');
            var startingIndex = lastRecord ? lastRecord.recordIndex + 1 : 0;
            if(transactionLog) transactionLog.logInfo('GEN_PDF_RCRD','Generating records for PDF batch.', {startingIndex: startingIndex});
            parsedRecords = generateRecordsFromPdf(importBatch, startingIndex);
        }
        else if (importBatch.batchDataType == 'dsv')
            parsedRecords = generateRecordsFromDsv(importBatch);
        else
            throw new Error('Attempting to parse records from unknown batchDataType: ' + importBatch.batchDataType);
        return Promise.resolve(parsedRecords);
    })
    .then(function(records) {
        if (!records || records.length == 0) {
            if(transactionLog) transactionLog.logInfo('NO_REC_GEN','No records generated for batch.');
            //return Promise.reject(new Error('Batch data contains no records.'));
            return Promise.resolve([]);
        }

        //console.log('Parsed data, found ' + records.length + ' records...');
        return Promise.each(records, function(record, index, arr) {
            console.log('Persisting import batch record ' + (index+1) + ' of ' + records.length + '...');
            return _createBatchRecord(importBatch, record);
        });
    })
    .then(function(generatedRecords) {
        console.log('Completed generating records.');
        //console.log(generatedRecords);
        importBatchRecords = generatedRecords;
        return _updateBatchCounts(importBatch.importBatchGuid);
    })
    .then(function() {
        console.log('Completed creating batch.');

        // If a batch is already assigned a user and a facility, we go ahead and open it for processing.
        if(importBatchRecords.length == 0) {
            // We do this because the batch has already been marked as complete.
            return Promise.resolve();
        }
        else if(skipProcessing !== true && importBatch.assignedTo && importBatch.facilityId != null) {
            console.log('Default reviewer and facility assigned, opening batch for processing.');
            return openBatchForProcessing(importBatch.importBatchGuid, importBatch.assignedTo);
        }
        else {
            console.log('Indicating batch generation is complete.');
            return indicateBatchGenerationComplete(importBatch.importBatchGuid);
        }
    })
    .then(function() {
        return Promise.resolve(importBatchRecords);
    })
    .catch(function(error) {
        // We are basically ignoring all errors here. We log the error in the database so the user will see it
        // and then move on.
        console.error(error.message);
        console.error(error.stack);
        if(error.ignoreError) {
            return Promise.resolve([]);
        }
        else {
            if(transactionLog) transactionLog.logError('IMPT_BTCH_DAO_ERR', 'Unable to generate records: ' + error.message, error);
            return indicateBatchGenerationError(importBatchGuid, error.message)
            .then(function() {
                return Promise.resolve([]);
            })
        }
    });
}

function _setBatchPageCount(importBatchGuid, pageCount) {
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            Key: {
                importBatchGuid: importBatchGuid
            },
            UpdateExpression: 'set batchDataPdfPageCount = :pageCount, lastUpdatedAt = :now',
            ConditionExpression: 'attribute_exists(importBatchGuid)',
            ExpressionAttributeValues: {
                ':pageCount': pageCount,
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(pageCount);
        });
    });
}

function updateImportBatchPdfPageCount(importBatchGuid) {
    console.log('Updating import batch pdf page count, retrieving records.');
    return getImportBatchDdb(importBatchGuid)
    .then(function(importBatchResult) {
        console.log('Retrieved batch data.');
        importBatch = importBatchResult;
        if(importBatch.batchDataType == 'pdf') {

            console.log('Determining pdf page count.');
            return retrieveImportBatchDataFromS3(importBatch.importBatchGuid)
            .then(function(batchData) {
                return pdfImageGenerator.getPdfPageCount(batchData);
            });
        }
        else {
            return Promise.resolve(null);
        }
    })
    .then(function(pageCount) {
        if(importBatch.batchDataType == 'pdf') {
            console.log('Determined page count: ' + pageCount);
            return _setBatchPageCount(importBatchGuid, pageCount);
        }
        else {
            return Promise.resolve(pageCount);
        }
    });
}

function getBatchByGuid(importBatchGuid, withData, withRecords, withRecordData) {
    var importBatch;

    return getImportBatchDdb(importBatchGuid)
        .then(function(importBatchDdb) {
            importBatch = importBatchDdb;

            if(importBatch.batchDataPdfPageCount == null && importBatch.batchDataType == 'pdf') {
                console.log('Batch does not specify PDF page count, updating value.');
                return updateImportBatchPdfPageCount(importBatchGuid)
                .catch(function(error) {
                    return Promise.resolve(null);
                })
            }
            else {
                return Promise.resolve();
            }
        })
        .then(function(pageCount) {
            if(importBatch.batchDataPdfPageCount == null)
                importBatch.batchDataPdfPageCount = pageCount;

            if (withData) {
                return retrieveImportBatchDataFromS3(importBatchGuid);
            } else {
                return Promise.resolve(null);
            }
        })
        .then(function(batchData) {

            importBatch.batchData = batchData;

            if (importBatch.batchData && importBatch.batchDataType == 'csv')
                importBatch.batchData = batchData.toString();

            if (withRecords)
                return getBatchRecords(importBatch.importBatchGuid, withRecordData);
            else
                return Promise.resolve(null);
        })
        .then(function(importBatchRecords) {
            importBatch.records = importBatchRecords;
            return Promise.resolve(importBatch);
        });
}

// Returns batches that are incomplete.
function getIncompleteBatches(orgInternalName) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            FilterExpression: "batchStatus in (:pendingGeneration,:generating,:generationError,:triage,:processing,:pendingReview) and orgInternalName = :orgInternalName",
            ExpressionAttributeValues: {
                ":triage": "triage",
                ":processing": "processing",
                ":pendingReview": "pending_review",
                ':pendingGeneration': "pending_generation",
                ":generating": "generating",
                ":generationError": "generation_error",
                ":orgInternalName": orgInternalName
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

function getAllDataEntryBatchesForOrgs(org, after) {
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            FilterExpression: "batchDataType = :batchDataType and batchStatus in (:processing,:pendingReview,:complete) and orgInternalName = :orgInternalName and createdAt >= :after",
            ExpressionAttributeValues: {
                ":batchDataType": "pdf",
                ":processing": "processing",
                ":pendingReview": "pending_review",
                ':complete': "complete",
                ":orgInternalName": org,
                ":after": after
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

function getAllProcessableBatches(orgInternalName) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            FilterExpression: "batchStatus in (:processing,:pendingReview,:complete) and orgInternalName = :orgInternalName",
            ExpressionAttributeValues: {
                ":processing": "processing",
                ":pendingReview": "pending_review",
                ':complete': "complete",
                ":orgInternalName": orgInternalName
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


// Returns batches that are incomplete.
function getAllCompleteBatches(orgInternalName) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            FilterExpression: "batchStatus = :complete and orgInternalName = :orgInternalName",
            ExpressionAttributeValues: {
                ":complete": "complete",
                ":orgInternalName": orgInternalName
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

function getCompleteBatches(orgInternalName) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            FilterExpression: "batchStatus = :complete and orgInternalName = :orgInternalName",
            ExpressionAttributeValues: {
                ":complete": "complete",
                ":orgInternalName": orgInternalName
            }
        };

        var docClient = ddb.createDocClient();
        docClient.scan(params, function(err, data) {
            if (err) {
                reject(err);
                return;
            }
            resolve(data.Items);
        });
    });
}

function getBatchRecords(importBatchGuid, withData) {
    return new Promise(function(resolve, reject) {
            var params = {
                TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
                KeyConditionExpression: "importBatchGuid = :importBatchGuid and recordIndex >= :zero",
                ExpressionAttributeValues: {
                    ":importBatchGuid": importBatchGuid,
                    ":zero": 0
                }
            };

            var allItems = [];
            var getResults = function(lastEvaluatedKey) {
                if(lastEvaluatedKey) {
                    params.ExclusiveStartKey = lastEvaluatedKey;
                }

                var docClient = ddb.createDocClient();
                docClient.query(params, function(err, data) {
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
        })
        .then(function(importBatchRecords) {
            if (!withData)
                return Promise.resolve(importBatchRecords);

            return Promise.each(importBatchRecords, function(importBatchRecord, idx, arr) {
                return retrieveImportBatchRecordDataFromS3(importBatchRecord.importBatchRecordGuid)
                    .then(function(importBatchRecordData) {
                        importBatchRecord.recordData = JSON.parse(importBatchRecordData);
                        return Promise.resolve(importBatchRecord);
                    });
            });
        });
}

function getPreviousRecord(importBatchGuid, recordIndex) {
    if(recordIndex == 0) {
        return Promise.resolve(null);
    }

    return getBatchRecord(importBatchGuid, recordIndex-1, false, true)
    .then(function(importBatchRecord) {
        return Promise.resolve(importBatchRecord);
    })
    .catch(function(err) {
        return Promise.resolve(null);
    })
}

function getBatchRecord(importBatchGuid, recordIndex, withRecordData, withDataEntryData) {

    return new Promise(function(resolve, reject) {
            //console.log('Retrieving batch record from ddb: ' + importBatchGuid + ':' + recordIndex);
            var params = {
                TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
                KeyConditionExpression: "importBatchGuid = :importBatchGuid and recordIndex = :recordIndex",
                ExpressionAttributeValues: {
                    ":importBatchGuid": importBatchGuid,
                    ":recordIndex": recordIndex
                }
            };

            var docClient = ddb.createDocClient();
            docClient.query(params, function(err, data) {
                if (err) reject(err);
                else if(data.Items && data.Items.length == 1) resolve(data.Items[0]);
                else reject(new Error('No import batch record found for that batch ID and index.'));
            });
        })
        .then(function(importBatchRecord) {
            if (!withRecordData) {
                //console.log('Not retrieving record data, moving to next promise...');
                return Promise.resolve(importBatchRecord);
            }

            return retrieveImportBatchRecordDataFromS3(importBatchRecord.importBatchRecordGuid)
            .then(function(importBatchRecordData) {
                importBatchRecord.recordData = JSON.parse(importBatchRecordData);
                return Promise.resolve(importBatchRecord);
            })
            .catch(function(error) {
                console.error('Unable to retrieve batch record data: ' + error.code);
                if(error.code == "NoSuchKey" && importBatchRecord.recordDataType == "pdf_bitmap_pages") {
                    return regenerateRecordImage(importBatchGuid, recordIndex)
                    .then(function(recordData) {
                        importBatchRecord.recordData = recordData;
                        return Promise.resolve(importBatchRecord);
                    })
                }
                else {
                    return Promise.reject(error);
                }
            });
        })
        .then(function(importBatchRecordWithData) {
            if(!withDataEntryData) {
                //console.log('Not retrieving data entry data, completed loading record...');
                return Promise.resolve(importBatchRecordWithData);
            }

            //console.log('Retrieving data entry data...');
            return retrieveImportBatchRecordDataEntryDataFromS3(importBatchRecordWithData.importBatchGuid, importBatchRecordWithData.recordIndex)
                .then(function(dataEntryDataObject) {
                    //console.log('Retrieved data entry data...');
                    //console.log(dataEntryDataObject);
                    importBatchRecordWithData.dataEntryData = dataEntryDataObject;
                    return Promise.resolve(importBatchRecordWithData);
                })
                .catch(function(error) {
                    if(error.code == 'NoSuchKey') {
                        importBatchRecordWithData.dataEntryData = {};
                        return Promise.resolve(importBatchRecordWithData);
                    }
                    else {
                        throw error;
                    }
                });
        });
}

function getBatchRecordStatuses(importBatchGuid) {
    //console.log('Getting batch record statuses...');
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            KeyConditionExpression: "importBatchGuid = :importBatchGuid and recordIndex >= :zero",
            ExpressionAttributeValues: {
                ":importBatchGuid": importBatchGuid,
                ":zero": 0
            },
            ProjectionExpression: "recordStatus, importBatchGuid, importBatchRecordGuid, recordIndex",
            ConsistentRead: true
        };

        var allItems = [];
        var getResults = function(lastEvaluatedKey) {
            if(lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }

            var docClient = ddb.createDocClient();
            docClient.query(params, function(err, data) {
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
        return undefined;
    });
}

function _setBatchStatusCounts(importBatchGuid, records, statusCounts, batchComplete) {
    return new Promise(function(resolve, reject) {

        if(records.length == 0) {
            var batchComplete = true;
            var batchPendingReview = false;
        }
        else {
            var batchComplete = isBatchComplete(records, statusCounts);
            var batchPendingReview = isBatchPendingReview(records, statusCounts);
        }

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            Key: {
                importBatchGuid: importBatchGuid
            },
            UpdateExpression: 'set statusCounts = :statusCounts, lastUpdatedAt = :now',
            ExpressionAttributeValues: {
                ':statusCounts': statusCounts,
                ':now': new Date().getTime()
            }
        };

        if(batchPendingReview) {
            params.UpdateExpression += ', batchStatus = :pendingReview';
            params.ExpressionAttributeValues[':pendingReview'] = 'pending_review';
        }
        else if(batchComplete) {
            params.UpdateExpression += ', batchStatus = :complete, completedAt = :now remove assignedTo';
            params.ExpressionAttributeValues[':complete'] = 'complete';
        }

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    });
}

function isBatchComplete(importBatchRecords, statusCounts) {
    // The batch is considered complete if all the records are in
    // eitehr processing_complete, discarded or rejected status.
    var totalRecords = importBatchRecords.length;
    return ((statusCounts.processing_complete || 0) +
            (statusCounts.discarded || 0) +
            (statusCounts.ignored || 0))
            == totalRecords;
}

function isBatchPendingReview(importBatchRecords, statusCounts) {
    // The batch is considered complete if all the records are in
    // eitehr processing_complete, discarded or rejected status.
    var totalRecords = importBatchRecords.length;
    return  (statusCounts.hasOwnProperty('pending_review') && statusCounts.pending_review > 0) &&
            ((statusCounts.processing_complete || 0) +
             (statusCounts.discarded || 0) +
             (statusCounts.ignored || 0) +
             (statusCounts.pending_review || 0))
            == totalRecords;
}

function _updateBatchCounts(importBatchGuid) {
    return getBatchRecordStatuses(importBatchGuid)
        .then(function(records) {
            var statusCounts = {};
            for (var i = 0; i < records.length; i++) {
                var record = records[i];
                if (record.recordStatus) {
                    if (!statusCounts.hasOwnProperty(record.recordStatus))
                        statusCounts[record.recordStatus] = 0;
                    statusCounts[record.recordStatus]++;
                }
            }
            return _setBatchStatusCounts(importBatchGuid, records, statusCounts);
        });
}

function grabBatch(orgInternalName, username) {
    var grabbedBatch;
    return getUnassignedBatches(orgInternalName)
    .then(function(unassignedBatches) {
        if(!unassignedBatches || unassignedBatches.length == 0) {
            return Promise.reject(new Error('Unable to grab a new batch, there are no batches that are currently available to be assigned.'));
        }
        else {
            var sortedBatches = _.sortBy(unassignedBatches, 'createdAt');
            grabbedBatch = sortedBatches[0];

            if(grabbedBatch.batchStatus == 'triage') {
                return openBatchForProcessing(grabbedBatch.importBatchGuid, username, true);
            }
            else if(grabbedBatch.batchStatus == 'processing') {
                return assignBatch(grabbedBatch.importBatchGuid, username, true);
            }
            else {
                return Promise.reject(new Error('Batch not in correct status to be assigned.'));
            }
        }
    })
    .then(function() {
        return Promise.resolve(grabbedBatch.importBatchGuid);
    })
}

function getUnassignedBatches(orgInternalName) {
    return ddb.scanAll(
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
        "batchStatus in (:triage, :processing) and attribute_exists(facilityId) and not attribute_exists(assignedTo) and orgInternalName = :orgInternalName",
        {
            ":triage": "triage",
            ":processing": "processing",
            ":orgInternalName": orgInternalName
        },
        {
            ProjectionExpression: 'importBatchGuid,createdAt, batchStatus,facilityId,assignedTo'
        }
    );
}

function getAllBatchesPendingGeneration() {
    return ddb.scanAll(
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
        "batchStatus in (:pending_generation)",
        {
            ":pending_generation": "pending_generation"
        },
        {
            ProjectionExpression: 'importBatchGuid,createdAt, batchStatus, batchDataType, batchName, batchSource, orgInternalName, facilityId'
        }
    );
}

// Can only assign batches that are in 'triage' or 'processing' states.
function assignBatch(importBatchGuid, username, onlyIfUserNotAssigned) {
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            Key: {
                importBatchGuid: importBatchGuid
            },
            UpdateExpression: 'set assignedTo = :username, lastUpdatedAt = :now',
            ConditionExpression: 'attribute_exists(importBatchGuid) and batchStatus in (:triage, :processing, :pendingReview)',
            ExpressionAttributeValues: {
                ':username': username,
                ':triage': 'triage',
                ':processing': 'processing',
                ':pendingReview': 'pending_review',
                ':now': new Date().getTime()
            }
        };

        if(onlyIfUserNotAssigned) {
            params.ConditionExpression += " and (attribute_not_exists(assignedTo) or attribute_type(assignedTo, :null))";
            params.ExpressionAttributeValues[':null'] = "NULL";
        }

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    });
}

function getAssignedBatchesByUser(username, orgInternalName) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            IndexName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_ASSIGNED_TO_IDX'),
            KeyConditionExpression: "assignedTo = :username and orgInternalName = :orgInternalName",
            ExpressionAttributeValues: {
                ":username": username,
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

function ignoreAllBatchRecordsPendingReview(importBatchGuid) {
    var recordsPendingReview;
    return getBatchRecordStatuses(importBatchGuid)
    .then(function(records) {
        recordsPendingReview = _.filter(records, function(record) { return record.recordStatus == 'pending_review'; });

        return Promise.mapSeries(recordsPendingReview, function(record) {
            return ignoreRecord(record.importBatchGuid, record.recordIndex);
        });
    })
    .then(function(ignoreResults) {
        return Promise.resolve(recordsPendingReview);
    });
}

function indicateBatchGenerating(importBatchGuid) {
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            Key: {
                importBatchGuid: importBatchGuid
            },
            UpdateExpression: 'set lastUpdatedAt = :now, batchStatus = :generating',
            ConditionExpression: 'attribute_exists(importBatchGuid)', // and batchStatus in (:pendingGeneration, :generationError, :generating, :triage)',
            ExpressionAttributeValues: {
                ':generating': 'generating',
//                ':pendingGeneration': 'pending_generation',
//                ':generationError': 'generation_error',
//                ':triage': 'triage',
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    });
}

function _indicateBatchGenerationComplete(importBatchGuid) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            Key: {
                importBatchGuid: importBatchGuid
            },
            UpdateExpression: 'set lastUpdatedAt = :now, batchStatus = :triage',
            ConditionExpression: 'attribute_exists(importBatchGuid) and batchStatus in (:generating, :generationError)',
            ExpressionAttributeValues: {
                ':generating': 'generating',
                ':generationError': 'generation_error',
                ':triage': 'triage',
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    });
}

function indicateBatchGenerationComplete(importBatchGuid) {
    var importBatch;
    return getBatchByGuid(importBatchGuid, true, true)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;
        if(importBatch.batchDataType == 'pdf') {
            return pdfImageGenerator.getPdfPageCount(importBatch.batchData);
        }
        else {
            return Promise.resolve(-1);
        }
    })
    .then(function(pageCount) {
        if(importBatch.batchDataType == 'pdf') {
            if(importBatch.records.length == pageCount) {
                return _indicateBatchGenerationComplete(importBatchGuid);
            }
            else {
                return indicateBatchGenerationError(importBatchGuid, 'Unable to validate that all pages were generated.');
            }
        }
        else {
            return _indicateBatchGenerationComplete(importBatchGuid);
        }
    });
}

function indicateBatchGenerationError(importBatchGuid, errorMessage) {
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            Key: {
                importBatchGuid: importBatchGuid
            },
            UpdateExpression: 'set lastUpdatedAt = :now, batchStatus = :generationError, generationError = :generationErrorMessage',
            ConditionExpression: 'attribute_exists(importBatchGuid) and batchStatus in (:generating)',
            ExpressionAttributeValues: {
                ':generating': 'generating',
                ':generationError': 'generation_error',
                ':generationErrorMessage': errorMessage,
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    });
}

function discardBatch(importBatchGuid, discardReason) {
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            Key: {
                importBatchGuid: importBatchGuid
            },
            UpdateExpression: 'remove assignedTo set lastUpdatedAt = :now, discardedAt = :now, discardReason = :discardReason, batchStatus = :discarded',
            ConditionExpression: 'attribute_exists(importBatchGuid) and batchStatus in (:triage, :processing, :pendingReview, :generationError)',
            ExpressionAttributeValues: {
                ':triage': 'triage',
                ':processing': 'processing',
                ':pendingReview': 'pending_review',
                ':generationError': 'generation_error',
                ':now': new Date().getTime(),
                ':discardReason': discardReason,
                ':discarded': 'discarded'
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    });
}

function saveRecordDataEntryData(importBatchGuid, recordIndex, dataEntryData, dataEntryFormDefinitionName, dataEntryFormDefinitionVersion) {

    if(!_.isPlainObject(dataEntryData)) {
        console.error('is not object')
        return Promise.reject(new Error('Data entry data is not in correct format. Must be an object.'));
    }

    if(!dataEntryFormDefinitionName || !_.isInteger(dataEntryFormDefinitionVersion)) {
        return Promise.reject(new Error('Data entry form definition name or version not defined. Cannot save data.'));
    }

    var importBatchRecord;
    return getBatchRecord(importBatchGuid, recordIndex)
    .then(function(importBatchRecordResult) {
        importBatchRecord = importBatchRecordResult;

        // We determine if the record is currently in a state where the data entry data
        // can be edited and we can update the status to the next status. We support processing_failed
        // for legacy reasons.
        if(!_.includes(['pending_review','pending_data_entry','processing_complete','processing_failed'],importBatchRecord.recordStatus) ) {
            return Promise.reject(new Error('Record must be pending review, completed processing or pending data entry to allow data entry.'));
        }

        return saveImportBatchRecordDataEntryToS3(importBatchGuid, recordIndex, dataEntryData);
    })
    .then(function(persistedDataEntryData) {
        return indicateRecordDataEntry(importBatchGuid, recordIndex, dataEntryData.invalidFields , dataEntryData.dataEntryErrorFields , dataEntryFormDefinitionName, dataEntryFormDefinitionVersion, dataEntryData.responsibleProviderIds, dataEntryData.primaryResponsibleProviderId, dataEntryData.formServiceDate);
    })
    .then(function() {
        return Promise.resolve(dataEntryData);
    });
}

function touchRecord(importBatchGuid, recordIndex) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now',
            ConditionExpression: 'attribute_exists(importBatchGuid)',
            ExpressionAttributeValues: {
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    });
}


var addBatchToProcessingStream = function(importBatchGuid) {
    return new Promise(function(resolve,reject) {

        if(!importBatchGuid) {
            reject(new Error('Unable to add batch to processing queue, importBatchGuid not defined.'));
            return;
        }

        var params = {
            Records: [{
                Data: JSON.stringify({importBatchGuid:importBatchGuid}),
                PartitionKey: importBatchGuid
            }],
            StreamName: EnvironmentConfig.getProperty('collector-v1','KS_BATCH_PROCESSOR')
        };

        var kinesis = new AWS.Kinesis({region:"us-east-1"});
        kinesis.putRecords(params, function(err, data) {
            if (err) {
                err.message = 'Unable to add batch to processing stream. ('+err.message+')';
                reject(new Error(err))
            }
            else {
                resolve()
            }
        });
    });
}

var addBatchesToRecordReprocessorStream = function(importBatchGuids, userName, orgUserId, indexUserId) {
    return new Promise(function(resolve,reject) {

        if(!userName || orgUserId == null || indexUserId == null) {
            reject(new Error('Unable to add batch to reprocessing stream, user not defined.'));
            return;
        }

        var params = {
            Records: [],
            StreamName: EnvironmentConfig.getProperty('collector-v1','KS_BATCH_RECORD_REPROCESSOR')
        };

        for(var i = 0; i < importBatchGuids.length; i++) {
            var importBatchGuid = importBatchGuids[i];
            params.Records.push({
                Data: JSON.stringify({
                    importBatchGuid:importBatchGuid,
                    userName:userName,
                    orgUserId:orgUserId,
                    indexUserId:indexUserId
                }),
                PartitionKey: importBatchGuid
            })
        }

        var kinesis = new AWS.Kinesis({region:"us-east-1"});
        kinesis.putRecords(params, function(err, data) {
            if (err) {
                err.message = 'Unable to add batches to reprocessing stream. ('+err.message+')';
                reject(new Error(err))
            }
            else if(data.FailedRecordCount) {
                console.log('Unable to add all batches to reprocessing stream, failed to send count: ' + data.FailedRecordCount);
                resolve(data);
            }
            else {
                resolve(data)
            }
        });
    });
}

var addRecordToProcessingStream = function(importBatchGuid, recordIndex) {
    return new Promise(function(resolve,reject) {

        if(!importBatchGuid || !_.isInteger(recordIndex)) {
            reject(new Error('Unable to add record to processing queue, id or recordIndex not defined.'));
            return;
        }

        var params = {
            Records: [{
                Data: JSON.stringify({importBatchGuid:importBatchGuid, recordIndex:recordIndex}),
                PartitionKey: importBatchGuid + '::' + uuid.v4()
            }],
            StreamName: EnvironmentConfig.getProperty('collector-v1','KS_RECORD_PROCESSOR')
        };

        var kinesis = new AWS.Kinesis({region:"us-east-1"});
        kinesis.putRecords(params, function(err, data) {
            if (err) {
                err.message = 'Unable to add record processing stream. ('+err.message+')';
                reject(new Error(err))
            }
            else {
                resolve()
            }
        });
    });
}

var _addRecordsChunkToProcessingStream = function(importBatchRecords) {
    return new Promise(function(resolve,reject) {

        var params = {
            Records: [],
            StreamName: EnvironmentConfig.getProperty('collector-v1','KS_RECORD_PROCESSOR')
        };

        for(var i = 0; i < importBatchRecords.length; i++) {
            params.Records.push({
                Data: JSON.stringify({importBatchGuid:importBatchRecords[i].importBatchGuid, recordIndex:importBatchRecords[i].recordIndex}),
                PartitionKey: importBatchRecords[i].importBatchGuid + '::' + uuid.v4()
            })
        }

        //console.log('Putting records on stream: ');
        //console.log(params);

        var kinesis = new AWS.Kinesis({region:"us-east-1"});
        kinesis.putRecords(params, function(err, data) {
            //console.log(data);
            if (err) {
                err.message = 'Unable to add record processing stream. ('+err.message+')';
                reject(new Error(err))
            }
            else if(data.FailedRecordCount) {
                console.log('Unable to add all records to queue, failed to send count: ' + data.FailedRecordCount);
                resolve(data.Records);
            }
            else {
                console.log('Added ' + params.Records.length + ' records to the processing stream.');
                resolve(data.Records);
            }
        });
    });
}

var addRecordsToProcessingStream = function(importBatchRecords) {
    var chunks = _.chunk(importBatchRecords, 250);
    return Promise.mapSeries(chunks, function(chunk) {
        return _addRecordsChunkToProcessingStream(chunk);
    });
}

function indicateRecordDataEntry(importBatchGuid, recordIndex, dataEntryInvalidFields, dataEntryErrorFields, dataEntryFormDefinitionName, dataEntryFormDefinitionVersion, responsibleProviderIds, primaryResponsibleProviderId, formServiceDate ) {
    var updatedBatchRecord;

    if(!_.isInteger(primaryResponsibleProviderId) && _.isArray(responsibleProviderIds) && responsibleProviderIds.length > 0) {
        primaryResponsibleProviderId = responsibleProviderIds[0];
    }

    return getBatchRecord(importBatchGuid, recordIndex)
    .then(function(batchRecord) {
        return new Promise(function(resolve, reject) {

            var params = {
                TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
                Key: {
                    importBatchGuid: importBatchGuid,
                    recordIndex: recordIndex
                },
                UpdateExpression: 'set lastUpdatedAt = :now, ' +
                                'lastDataEntryFormDefinitionName = :lastDataEntryFormDefinitionName, ' +
                                'lastDataEntryFormDefinitionVersion = :lastDataEntryFormDefinitionVersion, ' +
                                'dataEntryInvalidFields = :dataEntryInvalidFields, ' +
                                'dataEntryErrorFields = :dataEntryErrorFields, ' +
                                'dataEntryDataIndicated = :dataEntryDataIndicated, ' +
                                'responsibleProviderIds = :responsibleProviderIds, ' +
                                'primaryResponsibleProviderId = :primaryResponsibleProviderId, ' +
                                'formServiceDate = :formServiceDate',
                ConditionExpression: 'attribute_exists(importBatchGuid)',
                ExpressionAttributeValues: {
                    ':lastDataEntryFormDefinitionName': dataEntryFormDefinitionName,
                    ':lastDataEntryFormDefinitionVersion': dataEntryFormDefinitionVersion,
                    ':dataEntryInvalidFields': dataEntryInvalidFields,
                    ':dataEntryErrorFields': dataEntryErrorFields,
                    ':dataEntryDataIndicated': true,
                    ':responsibleProviderIds': responsibleProviderIds,
                    ':primaryResponsibleProviderId': primaryResponsibleProviderId,
                    ':formServiceDate': formServiceDate,
                    ':now': new Date().getTime()
                },
                ReturnValues: 'ALL_NEW'
            };

            // This means this is the first time we are saving the data entry data, so we permanenty persist
            // the initial dataEntryErrors so that we can later analyze provider/user data entry error statistics
            // even though they may be fixed.
            if(batchRecord.recordStatus == 'pending_data_entry') {
                params.UpdateExpression += ', initialDataEntryErrorFields = :initialDataEntryErrorFields';
                params.ExpressionAttributeValues[':initialDataEntryErrorFields'] = dataEntryErrorFields;
            }

            params.UpdateExpression += ', recordStatus = :recordStatus';
            params.ConditionExpression += ' and recordStatus in (:pendingDataEntry, :pendingReview, :processingComplete, :processingFailed)';
            params.ExpressionAttributeValues[':recordStatus'] = 'pending_processing';
            params.ExpressionAttributeValues[':pendingDataEntry'] = 'pending_data_entry';
            params.ExpressionAttributeValues[':pendingReview'] = 'pending_review';
            params.ExpressionAttributeValues[':processingComplete'] = 'processing_complete';
            params.ExpressionAttributeValues[':processingFailed'] = 'processing_failed';

            var docClient = ddb.createDocClient();
            docClient.update(params, function(err, data) {
                if (err) reject(err);
                else resolve(data.Attributes);
            });
        })
    })
    .then(function(importBatchRecordResult) {
        updatedBatchRecord = importBatchRecordResult;
        return _updateBatchCounts(importBatchGuid);
    })
    .then(function() {
        return addRecordToProcessingStream(importBatchGuid, recordIndex);
    })
    .then(function() {
        return Promise.resolve(importBatchGuid);
    })
}

function submitRecordsForProcessing(importBatchRecords) {
    var submitRecordResults = null;
    return Promise.map(importBatchRecords, function(importBatchRecord) {
        return submitRecordForProcessing(importBatchRecord, true)
        .then(function() {
            //console.log(' - Submitted record for processing: ' + importBatchRecord.recordIndex);
            return Promise.resolve(importBatchRecord);
        })
        .catch(function(error) {
            importBatchRecord.error = error;
            return Promise.resolve(importBatchRecord);
        })
    },{ concurrency: 20})
    .then(function(results) {
        submitRecordResults = results;
        //console.log(' - Submitted records for processing.')
        //console.log(JSON.stringify(results,null,4));
        return _updateBatchCounts(importBatchRecords[0].importBatchGuid);
    })
    .then(function() {

        return Promise.resolve(submitRecordResults);
    })
}

function submitRecordForProcessing(importBatchRecord, skipUpdateCounts) {
    //console.log(' - Submitting record for processing: ' + JSON.stringify(importBatchRecord));
    return indicateRecordPendingReprocessing(importBatchRecord.importBatchGuid, importBatchRecord.recordIndex, skipUpdateCounts)
    .then(function() {
        //console.log('   - Record status updated, adding to stream.');
        return addRecordToProcessingStream(importBatchRecord.importBatchGuid, importBatchRecord.recordIndex);
    })
    .then(function() {
        //console.log('   - Record added to stream.');
        return Promise.resolve(importBatchRecord);
    });
}

// This is for 'reprocessing' which is when the record in in pending_review or processing_complete.
function indicateRecordPendingReprocessing(importBatchGuid, recordIndex, skipUpdateCounts) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :pendingProcessing',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus in (:pendingProcessing, :processing, :processingComplete, :pendingReview)',
            ExpressionAttributeValues: {
                ':pendingReview': 'pending_review',
                ':processingComplete': 'processing_complete',
                ':processing': 'processing',
                ':pendingProcessing': 'pending_processing',
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) {
                if(err.code == 'ConditionalCheckFailedException') {
                    reject(new Error('Unable to reprocess record, record does not have correct status.'));
                }
                else {
                    reject(err);
                }
            }
            else {
                resolve(importBatchGuid);
            }
        });
    })
    .then(function(importBatchGuid) {
        if(skipUpdateCounts !== true) {
            //console.log('Not skipping update batch record counts.');
            return _updateBatchCounts(importBatchGuid);
        }
        else {
            ///console.log('SKIPPING update batch record counts.');
            return;
        }
    })
    .then(function() {
        return Promise.resolve(importBatchGuid);
    });
}

function indicateRecordPendingProcessing(importBatchGuid, recordIndex) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :pendingProcessing',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus in (:pendingDataEntry, :pendingReview)',
            ExpressionAttributeValues: {
                ':pendingReview': 'pending_review',
                ':pendingDataEntry': 'pending_data_entry',
                ':pendingProcessing': 'pending_processing',
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    })
    .then(function(importBatchGuid) {
        return _updateBatchCounts(importBatchGuid);
    })
    .then(function() {
        return Promise.resolve(importBatchGuid);
    })
}

function indicateRecordProcessing(importBatchGuid, recordIndex) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :processing, processingStartedAt = :now remove processingFailedReason',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus in (:pendingProcessing, :processing)',
            ExpressionAttributeValues: {
                ':pendingProcessing': 'pending_processing',
                ':processing': 'processing',
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    })
    .then(function(importBatchGuid) {
        return _updateBatchCounts(importBatchGuid);
    })
    .then(function() {
        return Promise.resolve(importBatchGuid);
    })
}

function updateRecordImageRotation(importBatchGuid, recordIndex, degrees) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordDataImageRotation = :recordDataImageRotation',
            ConditionExpression: 'attribute_exists(importBatchGuid)',
            ExpressionAttributeValues: {
                ':recordDataImageRotation': degrees,
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    });
}

// Will send a record back into the 'pending_review state'
function indicateRecordProcessingFailed(importBatchGuid, recordIndex, reason, processingData, updateCounts) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :pendingReview, processingData = :processingData, processingFailedReason = :reason remove processingStartedAt',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus in (:processing)',
            ExpressionAttributeValues: {
                ':pendingReview': 'pending_review',
                ':processing': 'processing',
                ':processingData': processingData,
                ':reason': reason,
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    })
    .then(function(importBatchGuid) {
        if(updateCounts === false) {
            return Promise.resolve();
        }
        else {
            return _updateBatchCounts(importBatchGuid);
        }
    })
    .then(function() {
        return Promise.resolve(importBatchGuid);
    })
}

function indicateRecordProcessingComplete(importBatchGuid, recordIndex, processingData, updateCounts) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :processingComplete, processingData = :processingData remove processingStartedAt, processingFailedReason',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus in (:processing)',
            ExpressionAttributeValues: {
                ':processingComplete': 'processing_complete',
                ':processing': 'processing',
                ':processingData': processingData,
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    })
    .then(function(importBatchGuid) {
        if(updateCounts === false) {
            return Promise.resolve();
        }
        else {
            return _updateBatchCounts(importBatchGuid);
        }
    })
    .then(function() {
        return Promise.resolve(importBatchGuid);
    })
}
/*
function indicateRecordPendingReview(importBatchGuid, recordIndex) {
    return new Promise(function(resolve, reject) {
        // Note that we only allow records that are in pending_data_entry to be sent back for review
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :pendingReview',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus in (:pendingDataEntry)',
            ExpressionAttributeValues: {
                ':now': new Date().getTime(),
                ':pendingReview': 'pending_review',
                ':pendingDataEntry': 'pending_data_entry'
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    })
    .then(function(importBatchGuid) {
        return _updateBatchCounts(importBatchGuid);
    })
    .then(function() {
        return Promise.resolve(importBatchGuid);
    })
}
*/

function undiscardRecord(importBatchGuid, recordIndex) {
    var updatedImportBatch;
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :pendingDataEntry',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus = :discarded',
            ExpressionAttributeValues: {
                ':now': new Date().getTime(),
                ':discarded': 'discarded',
                ':pendingDataEntry': 'pending_data_entry'
            },
            ReturnValues: 'ALL_NEW'
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Attributes);
        });
    })
    .then(function(importBatch) {
        updatedImportBatch = importBatch;
        return _updateBatchCounts(importBatchGuid);
    })
    .then(function() {
        return Promise.resolve(updatedImportBatch);
    })
}

function discardRecord(importBatchGuid, recordIndex, reason) {
    var updatedImportBatch;
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :discarded, discardReason = :reason',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus = :pendingDataEntry',
            ExpressionAttributeValues: {
                ':now': new Date().getTime(),
                ':discarded': 'discarded',
                ':reason': 'reason',
                ':pendingDataEntry': 'pending_data_entry',
            },
            ReturnValues: 'ALL_NEW'
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Attributes);
        });
    })
    .then(function(importBatch) {
        updatedImportBatch = importBatch;
        return _updateBatchCounts(importBatchGuid);
    })
    .then(function() {
        return Promise.resolve(updatedImportBatch);
    })
}

function unignoreRecord(importBatchGuid, recordIndex) {
    var updatedImportBatch;
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :pendingReview',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus in (:ignored)',
            ExpressionAttributeValues: {
                ':now': new Date().getTime(),
                ':ignored': 'ignored',
                ':pendingReview': 'pending_review'
            },
            ReturnValues: 'ALL_NEW'
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Attributes);
        });
    })
    .then(function(importBatch) {
        updatedImportBatch = importBatch;
        return _updateBatchCounts(importBatchGuid);
    })
    .then(function() {
        return Promise.resolve(updatedImportBatch);
    })
}

function ignoreRecord(importBatchGuid, recordIndex) {
    var updatedImportBatch;
    return new Promise(function(resolve, reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :ignored',
            ConditionExpression: 'attribute_exists(importBatchGuid) and recordStatus in (:pendingReview, :processingComplete)',
            ExpressionAttributeValues: {
                ':now': new Date().getTime(),
                ':ignored': 'ignored',
                ':pendingReview': 'pending_review',
                ':processingComplete': 'processing_complete'
            },
            ReturnValues: 'ALL_NEW'
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Attributes);
        });
    })
    .then(function(importBatch) {
        updatedImportBatch = importBatch;
        return _updateBatchCounts(importBatchGuid);
    })
    .then(function() {
        return Promise.resolve(updatedImportBatch);
    })
}

function addNoteToRecord(importBatchGuid, recordIndex, username, noteText) {

    return new Promise(function(resolve, reject) {

        var note = {
            createdBy: username,
            createdAt: Date.now(),
            note: noteText,
            noteGuid: uuid.v4()
        };

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, notes = list_append(notes, :note)',
            ConditionExpression: 'attribute_exists(importBatchGuid)',
            ExpressionAttributeValues: {
                ':now': new Date().getTime(),
                ':note': [note]
            },
            ReturnValues: 'ALL_NEW'
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(note.noteGuid);
        });
    });
}

function getRecordNotes(importBatchGuid, recordIndex) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            KeyConditionExpression: "importBatchGuid = :importBatchGuid and recordIndex = :recordIndex",
            ExpressionAttributeValues: {
                ":importBatchGuid": importBatchGuid,
                ":recordIndex": recordIndex
            },
            ProjectionExpression: "notes"
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            //console.log('Received record: ' + JSON.stringify({err:err,data:data},null,4));
            if (err) reject(err);
            else resolve(data.Items[0].notes);
        });
    })
}

function openBatchForProcessing(importBatchGuid, assignTo, onlyIfUserNotAssigned) {
    var pendingProcessingRecords;
    return getBatchRecords(importBatchGuid)
    .then(function(records) {
        pendingProcessingRecords = _.filter(records, {recordStatus: 'pending_processing'});

        return new Promise(function(resolve, reject) {

            if(!assignTo || !importBatchGuid) {
                reject('Unable to open batch for processing, importBatchGuid or assignTo not set.');
                return;
            }

            // Right now for consistency purposes we are allowing batches that are in 'generating' status to be
            // opened for processing.
            var params = {
                TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
                Key: {
                    importBatchGuid: importBatchGuid
                },
                UpdateExpression: 'set lastUpdatedAt = :now, batchStatus = :processing, assignedTo = :assignedTo',
                ConditionExpression: 'attribute_exists(importBatchGuid) and batchStatus in (:triage, :generating, :generationComplete) and attribute_exists(facilityId)',
                ExpressionAttributeValues: {
                    ':triage': 'triage',
                    ':processing': 'processing',
                    ':generating': 'generating',
                    ':generationComplete': 'generationComplete',
                    ':assignedTo': assignTo,
                    ':now': new Date().getTime()
                }
            };

            if(onlyIfUserNotAssigned) {
                params.ConditionExpression += " and (attribute_not_exists(assignedTo) or attribute_type(assignedTo, :null))";
                params.ExpressionAttributeValues[':null'] = "NULL";
            }

            var docClient = ddb.createDocClient();
            docClient.update(params, function(err, data) {
                if (err) reject(err);
                else resolve(importBatchGuid);
            });
        });
    })
    .then(function() {
        if(pendingProcessingRecords.length > 0) {
            // We do this, but catch the error. We don't want this to fail opening the batch
            return addRecordsToProcessingStream(pendingProcessingRecords)
            .then(function() {
                return Promise.resolve(importBatchGuid);
            })
            .catch(function(error) {
                return Promise.resolve(importBatchGuid);
            })
        }
        else {
            return Promise.resolve(importBatchGuid);
        }
    })
}

function setBatchFacility(importBatchGuid, facilityId) {
    return new Promise(function(resolve, reject) {

        if(!_.isInteger(facilityId)) {
            reject(new Error('Unable to set batch facility, facility identifier is not an int.'));
            return;
        }

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
            Key: {
                importBatchGuid: importBatchGuid
            },
            UpdateExpression: 'set lastUpdatedAt = :now, facilityId = :facilityId',
            ConditionExpression: 'attribute_exists(importBatchGuid) and batchStatus in (:triage)',
            ExpressionAttributeValues: {
                ':triage': 'triage',
                ':facilityId': facilityId,
                ':now': new Date().getTime()
            }
        };

        var docClient = ddb.createDocClient();
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(importBatchGuid);
        });
    });
}

module.exports = {
    mergePDFRecords: mergePDFRecords,
    addNoteToRecord: addNoteToRecord,
    getRecordNotes: getRecordNotes,
    createBatch: createBatch,
    getBatchRecords: getBatchRecords,
    getBatchRecord: getBatchRecord,
    discardRecord: discardRecord,
    undiscardRecord: undiscardRecord,
    ignoreRecord: ignoreRecord,
    ignoreAllBatchRecordsPendingReview: ignoreAllBatchRecordsPendingReview,
    unignoreRecord: unignoreRecord,
    saveRecordDataEntryData: saveRecordDataEntryData,
    getBatchByGuid: getBatchByGuid,
    getIncompleteBatches: getIncompleteBatches,
    getAllCompleteBatches: getAllCompleteBatches,
    getAllProcessableBatches: getAllProcessableBatches,
    getCompleteBatches: getCompleteBatches,
    assignBatch: assignBatch,
    getAssignedBatchesByUser: getAssignedBatchesByUser,
    discardBatch: discardBatch,
    grabBatch: grabBatch,
    addBatchToProcessingStream: addBatchToProcessingStream,
    generateImportBatchRecords: generateImportBatchRecords,
    indicateRecordProcessing: indicateRecordProcessing,
    indicateRecordProcessingFailed: indicateRecordProcessingFailed,
    indicateRecordProcessingComplete: indicateRecordProcessingComplete,
    setBatchFacility: setBatchFacility,
    openBatchForProcessing: openBatchForProcessing,
    getPreviousRecord: getPreviousRecord,
    updateRecordImageRotation: updateRecordImageRotation,
    submitRecordsForProcessing: submitRecordsForProcessing,
    submitRecordForProcessing: submitRecordForProcessing,
    addBatchesToRecordReprocessorStream: addBatchesToRecordReprocessorStream,
    addRecordsToProcessingStream: addRecordsToProcessingStream,
    regenerateRecordImage: regenerateRecordImage,
    _updateBatchCounts: _updateBatchCounts,
    updateBatchTemplate: updateBatchTemplate,
    getAllDataEntryBatchesForOrgs: getAllDataEntryBatchesForOrgs,
    getAllBatchesPendingGeneration: getAllBatchesPendingGeneration
};