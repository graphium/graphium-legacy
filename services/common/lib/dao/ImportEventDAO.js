var Promise = require('bluebird');
var uuid = require('uuid');
var winston = require('winston');
var _ = require('lodash');
var Joi = require('joi');
var ddb = require('../util/ddbUtil.js');
var s3 = require('../util/s3Util.js');

function validateEvent(event) {

    var schema = {
        eventType: Joi.string().valid([
          'batch_created',
          'batch_assigned',
          'batch_ignored',
          'batch_status_update',
          'batch_template_change',
          'batch_discarded',
          'batch_opened',
          'batch_facility_set',
          'batch_records_merged',
          'record_status_update', 
          'record_data_entered',
          'record_note_added',
          'record_opened',
          'record_discarded',
          'record_undiscarded',
          'record_ignored',
          'record_unignored',
          'record_processing_succeeded',
          'record_processing_failed',
          'record_reprocess',
          'fax_received',
          'ewf_opened',
          'ewf_saved'
          ]),
        importEventGuid: Joi.string().guid().required(),
        importBatchRecordGuid: Joi.string().guid(),
        importBatchGuid: Joi.string().guid(),
        externalWebFormGuid: Joi.string().guid(),
        faxLineGuid: Joi.string().guid(),
        importBatchGuidRecordIndex: Joi.string(),
        recordNoteGuid: Joi.string().guid(),
        userName: Joi.when('eventType', {
            is: Joi.any().valid(['record_processing_succeeded','record_processing_failed','ewf_opened','ewf_saved']),
            then: Joi.any().forbidden(),
            otherwise: Joi.string().required()
        }),
        orgUserId: Joi.when('eventType', {
            is: Joi.any().valid(['record_processing_succeeded','record_processing_failed','ewf_opened','ewf_saved']),
            then: Joi.any().forbidden(),
            otherwise: Joi.number().integer().required()
        }),
        indexUserId: Joi.when('eventType', {
            is: Joi.any().valid(['record_processing_succeeded','record_processing_failed','ewf_opened','ewf_saved']),
            then: Joi.any().forbidden(),
            otherwise: Joi.number().integer().required()
        }),
        eventTime: Joi.number().integer().required(),
        orgInternalName: Joi.string().required(),
        facilityId: Joi.number().integer(),
        eventData: Joi
            .when('eventType', {
                is: 'ewf_opened',
                then: Joi.object().keys({
                    sourceData: Joi.object()
                })
            })
            .when('eventType', {
                is: 'ewf_saved',
                then: Joi.object().keys({
                    sourceData: Joi.object()
                })
            })
            .when('eventType', {
                is: 'batch_created',
                then: Joi.any().forbidden()
            })
            .when('eventType', {
                is: 'batch_assigned',
                then: Joi.object().keys({
                  assignedTo: Joi.string().required()
                })
            })
            .when('eventType', {
                is: 'batch_records_merged',
                then: Joi.object().keys({
                  mergedIndexes: Joi.array().items(Joi.number().integer().required()).min(2),
                  newIndex: Joi.number().integer().required()
                })
            })
            .when('eventType', {
                is: 'batch_status_update',
                then: Joi.object().keys({
                  statusFrom: Joi.string(),
                  statusTo: Joi.string().required(),
                })
            })
            .when('eventType', {
                is: 'batch_discarded',
                then: Joi.any().forbidden()
            })
            .when('eventType', {
                is: 'batch_ignored',
                then: Joi.any().forbidden()
            })
            .when('eventType', {
                is: 'batch_opened',
                then: Joi.object().keys({
                  assignedTo: Joi.string().required()
                })
            })
            .when('eventType', {
                is: 'batch_facility_set',
                then: Joi.object().keys({
                  facilityId: Joi.number().integer().required()
                })
            })
            .when('eventType', {
                is: 'record_status_update',
                then: Joi.object().keys({
                  statusFrom: Joi.string(),
                  statusTo: Joi.string().required(),
                })
            })
            .when('eventType', {
                is: 'record_processing_succeeded',
                then: Joi.object().keys({
                    flowResult: Joi.object().required()
                })
            })
            .when('eventType', {
                is: 'record_processing_failed',
                then: Joi.object().keys({
                    reason: Joi.string().required(),
                    errorStack: Joi.string().allow(null).optional(),
                    flowResult: Joi.object().optional()
                })
            })
            .when('eventType', {
                is: 'record_data_entered',
                then: Joi.object().keys({
                  isInitialDataEntry: Joi.boolean().required(),
                  dataEntryFormDefinitionName: Joi.string().required(),
                  dataEntryFormDefinitionVersion: Joi.number().integer().required(),
                  responsibleProviderIds: Joi.array(),
                  primaryResponsibleProviderId: Joi.number().integer().allow(null),
                })
            })
            .when('eventType', {
                is: 'batch_template_change',
                then: Joi.object().keys({
                    oldTemplateGuid: Joi.string().optional(),
                    newTemplateGuid: Joi.string().required()
                })
            })
            .when('eventType', {
                is: 'record_note_added',
                then: Joi.object().keys({
                  noteGuid: Joi.string().required()
                })
            })
            .when('eventType', {
                is: 'record_opened',
                then: Joi.any().forbidden()
            })
            .when('eventType', {
                is: 'record_discarded',
                then: Joi.any().forbidden()
            })
            .when('eventType', {
                is: 'record_undiscarded',
                then: Joi.any().forbidden()
            })
            .when('eventType', {
                is: 'record_ignored',
                then: Joi.any().forbidden()
            })
            .when('eventType', {
                is: 'record_unignored',
                then: Joi.any().forbidden()
            })
            .when('eventType', {
                is: 'fax_received',
                then: Joi.any().forbidden()
            })
            .when('eventType', {
                is: 'record_reprocess',
                then: Joi.any().forbidden()
            })
    }

    var validationResult = Joi.validate(event, schema, {
        abortEarly: false,
        convert: false
    });
    if (validationResult.error) {
        var error = new Error('Import event object is invalid.');
        console.error(validationResult);
        error.validationError = validationResult.error;
        throw error;
    }
}

function getEvent(importEventGuid) {
    return new Promise(function(resolve,reject) {

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_EVENT'),
            KeyConditionExpression: "importEventGuid = :importEventGuid",
            ExpressionAttributeValues: {
                ":importEventGuid": importEventGuid
            }
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items[0]);
        });
    });
}

function getEventsForRecord(importBatchGuid, recordIndex) {
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_EVENT'),
            IndexName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_EVENT_IMPORT_BATCH_GUID_RECORD_INDEX_IDX'),
            KeyConditionExpression: "importBatchGuidRecordIndex = :importBatchGuidRecordIndex",
            ExpressionAttributeValues: {
                ":importBatchGuidRecordIndex": importBatchGuid + ':' + recordIndex
            }
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items);
        });
    })
    .then(function(events) {
        return Promise.each(events, function(event, index, arr) {
            if((event.eventType == 'record_processing_failed' || event.eventType == 'record_processing_succeeded') && !event.eventData.flowResult) {
                return getEventFlowScriptResult(event.eventGuid)
                .then(function(flowResult) {
                    event.eventData.flowResult = flowResult;
                    return Promise.resolve(event);
                })
                .catch(function(error) {
                    event.eventData.flowResult = null;
                    return Promise.resolve(event);
                })
            }
            else {
                return Promise.resolve(event);
            }
        });
    })
}

function createEvent(importEvent, tl) {
    importEvent.importEventGuid = uuid.v4();
    importEvent.eventTime = Date.now();

    try {
        validateEvent(importEvent);
        if(tl) tl.logInfo('VAL_EVT', 'Validating audit event.');
    }
    catch(error) {
        if(tl) tl.logInfo('EVT_VAL_FAILED', 'Unable to validate audit event, failing.');
        return Promise.reject(error);
    }
    
    if(tl) tl.logInfo('VAL_AUD_EVT', 'Validated audit event.', { importEvent: importEvent});

    var storeResultInS3 = false;
    var flowResult; 
    if(importEvent.eventData) {
        if(importEvent.eventData.flowResult) {
            storeResultInS3 = true;
            flowResult = importEvent.eventData.flowResult;
            delete importEvent.eventData.flowResult;
        }
        else if(importEvent.eventData.sourceData) {
            storeResultInS3 = true;
            flowResult = importEvent.eventData.sourceData;
            delete importEvent.eventData.sourceData;
        }
    }

    if(tl) tl.logInfo('STR_EVT', 'Storing audit event in DDB.');
    return ddb.putUnique(EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_EVENT'), importEvent, "importEventGuid")
    .then(function() {
        if(tl) tl.logInfo('STR_EVT_SUC', 'Stored audit event in DDB.');

        if(storeResultInS3) {
            return s3.putObjectUnique(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_PROC_SCRPT_RESULT'), importEvent.importEventGuid, JSON.stringify(flowResult))
            .then(function(result) {
                return Promise.resolve(true);
            })
            .catch(function(error) {
                return Promise.resolve(true);
            })
        }
        else {
            return Promise.resolve(true);
        }
    })
    .catch(function(error) {
        if(tl) tl.logError('STR_EVT_FAIL', 'Failed to store audit event in DDB: '+error.message);
        console.error(error.message);
        return Promise.resolve(false);
    })
}

function getEventFlowScriptResult(eventGuid) {
    return s3.getObjectBody(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_PROC_SCRPT_RESULT'), eventGuid)
    .then(function(body) {
        return Promise.resolve(JSON.parse(body));
    })
    .catch(function(error) {
        if(error.code == 'NoSuchKey') {
            return Promise.resolve(null);
        }
        return Promise.reject(error);
    })
}

module.exports = {
    createEvent: createEvent,
    getEventsForRecord: getEventsForRecord,
    getEventFlowScriptResult: getEventFlowScriptResult,
    getEvent: getEvent
}