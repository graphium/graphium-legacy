import { ImportBatch, ImportBatchSource, ImportBatchDataType, BatchSourceFaxIds, BatchSourceFtpIds, DsvBatchDataTypeOptions, BatchSourceManualIds, BatchSourceExternalWebFormIds, ImportBatchStatus } from "../model/collector/ImportBatch";
import * as _ from 'lodash';
import * as uuid from 'uuid';
import * as moment from 'moment';
import * as Bluebird from 'bluebird';
import * as ddb from '../util/DynamoHelper';
import * as es from '../util/esUtil';

import * as ImportBatchDAO from './ImportBatchDAO';
import * as ImportEventDAO from './ImportEventDAO';
import * as ImportBatchRecordDAO from './ImportBatchRecordDAO';
import * as FlowDAO from './FlowDAO';
import { FlowScript } from '../flowScript/FlowScript';
import { ImportBatchRecordProcessingResult } from '../model/collector/ImportBatchRecordProcessingResult';
import { EnvironmentConfig } from '../config/EnvironmentConfig';

import { ImportBatchRecord, ImportBatchRecordStatus, ImportBatchRecordDataType, ExternalWebFormData, DsvRowData, PdfBitmapPageData, RecordDataTypes, validateNewImportBatchRecord } from "../model/collector/ImportBatchRecord";
import { ExpressionAttributeValueMap, UpdateItemInput } from "aws-sdk/clients/dynamodb";
import { RecordStatusResult } from "./ImportBatchRecordDAO";

interface CreateExternalWebFormBatchRequest {
    receivedAt?: number;
    batchName: string;
    searchKey?: string;
    orgInternalName: string;
    facilityId: number;
    batchSourceIds: BatchSourceExternalWebFormIds;
    flowGuid: string;
}
export async function createExternalWebFormBatch(request:CreateExternalWebFormBatchRequest):Promise<ImportBatch> {
    let now = new Date().getTime();
    let batch = <ImportBatch> {
        batchName: request.batchName,
        searchKey: request.searchKey,
        orgInternalName: request.orgInternalName,
        facilityId: request.facilityId,
        batchSource: ImportBatchSource.ExternalWebForm,
        batchSourceIds: request.batchSourceIds,
        batchDataType: ImportBatchDataType.None,
        requiresDataEntry: false,
        assignedTo: undefined,
        processingType: 'flow',
        flowGuid: request.flowGuid,
        batchTemplateGuid: undefined,
        batchDataTypeOptions: null,
        batchData: null,
        importBatchGuid: uuid.v4(),
        createdAt: now,
        lastUpdatedAt: now,
        receivedAt: request.receivedAt ? request.receivedAt : now,
        batchStatus: ImportBatchStatus.Processing,
        dataEntryFormDefinitionName: null
    };

    await ImportBatchRecordDAO.createImportBatchDynamo(batch);   

    // We don't persist anything to s3, or process 
    // any records since there are none yet. 
    return batch;
}

interface CreateExternalWebFormBatchRecordRequest {
    searchKey?: string;
    secondarySearchKey?: string;
    importBatchGuid: string;
    orgInternalName: string;
    facilityId: number;
    formServiceDate: string | null;
    sourceData: any;
    formDefinitionName: string;
    recordId: string;
    caseId?:string;
}
export async function createExternalWebFormBatchRecord(request:CreateExternalWebFormBatchRecordRequest):Promise<ImportBatchRecord> {
    
    let formServiceDateString:string = null;
    if(request.formServiceDate !== null) {
        let formServiceDate = moment(request.formServiceDate, ['YYYY-MM-DD','MM-DD-YYYY']);
        if(formServiceDate.isValid()) {
            formServiceDateString = formServiceDate.format('MM-DD-YYYY');
        }
        else {
            throw new Error('Invalid form service date format, should be in MM-DD-YYYY or YYYY-MM-DD.');
        }
    }

    let now = new Date().getTime();
    let maxRecordIndex = await ImportBatchRecordDAO.getMaxRecordIndex(request.importBatchGuid);
    let record = <ImportBatchRecord>{
        importBatchRecordGuid: uuid.v4(),
        searchKey: request.searchKey,
        secondarySearchKey: request.secondarySearchKey,
        importBatchGuid: request.importBatchGuid,
        orgInternalName: request.orgInternalName,
        facilityId: request.facilityId,
        recordDataType: ImportBatchRecordDataType.ExternalWebForm,
        recordData: <ExternalWebFormData>{
            sourceData: request.sourceData,
            formDefinitionName: request.formDefinitionName,
            recordId: request.recordId,
            caseId: request.caseId
        },
        recordStatus: ImportBatchRecordStatus.PendingDataEntry,
        recordIndex: maxRecordIndex + 1,
        recordOrder: maxRecordIndex + 1,
        dataEntryBy: [],
        createdAt: now,
        lastUpdatedAt: now,
        dataEntryDataIndicated: false,
        dataEntryErrorFields: [],
        dataEntryInvalidFields: [],
        formServiceDate: formServiceDateString,
        notes: []
    }

    validateNewImportBatchRecord(record);

    await ImportBatchRecordDAO.createImportBatchRecordDynamo(record);
    await ImportBatchRecordDAO.saveS3ImportBatchRecordData(record.importBatchRecordGuid, record.recordData);
    return record;
}

export async function saveExternalWebFormRecordDataEntryData(importBatchGuid:string, recordIndex:number, page:string, fieldValues:{[name:string]:any}, reporterName:string, totalFieldCount:number, invalidFieldCount:number, appendingFields?:string[]) {

    var importBatchRecord = await ImportBatchRecordDAO.getBatchRecordDynamo(importBatchGuid, recordIndex);
    if(!importBatchRecord) {
        throw new Error('Unable to save data entry data, this record does not exist.');
    }
    
    let existingDataEntryData = await ImportBatchRecordDAO.retrieveS3ImportBatchRecordDataEntryData(importBatchGuid, recordIndex);
    
    if(existingDataEntryData && appendingFields) {
        for(let fieldName of appendingFields) {
            let oldValue = existingDataEntryData[fieldName];
            let newValue = fieldValues[fieldName];
            if( (oldValue === null || oldValue === undefined) && _.isString(newValue) ) {
                newValue = '[' + reporterName + '] ' + newValue;
            }
            if(_.has(existingDataEntryData,fieldName) && oldValue !== null && _.has(fieldValues,fieldName) && newValue !== null) {

                if(_.isString(oldValue) && _.isString(newValue)) {
                    fieldValues[fieldName] = oldValue + '\n\n' + newValue;
                }

                if(_.isArray(oldValue) && _.isArray(newValue)) {
                    fieldValues[fieldName] = _.uniq(_.concat(oldValue, newValue));
                }
            }
        }
    }

    for(let newFieldName of Object.keys(fieldValues)) {
        existingDataEntryData[newFieldName] = fieldValues[newFieldName]
    }

    existingDataEntryData.totalFieldCount = totalFieldCount;
    existingDataEntryData.invalidFieldCount = invalidFieldCount;

    await ImportBatchRecordDAO.saveS3ImportBatchRecordDataEntryData(importBatchGuid, recordIndex, existingDataEntryData);
    
    let result = await indicateExternalWebFormRecordDataEntry(importBatchGuid, recordIndex, page, reporterName, importBatchRecord);

    await ImportBatchDAO.submitRecordForProcessing(importBatchRecord);

    return result;
}

async function indicateExternalWebFormRecordDataEntry(importBatchGuid:string, recordIndex:number, page:string, reporterName:string, importBatchRecord?:ImportBatchRecord) {
    
    if(!importBatchRecord) {
        importBatchRecord = await ImportBatchRecordDAO.getBatchRecord(importBatchGuid, recordIndex);
    }

    if(!importBatchRecord) {
        throw new Error('Unable to indicate data entry complete, record not found.');
    }


    let pageUpdateResults = importBatchRecord.pageUpdateResults;
    if(!pageUpdateResults) {
        pageUpdateResults = {};
    }
    pageUpdateResults[page] = {
        lastUpdated: new Date().getTime(),
        reporterName: reporterName
    }

    let updateResult = await ddb.createDocClient().update({
        TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
        Key: {
            importBatchGuid: importBatchGuid,
            recordIndex: recordIndex
        },
        UpdateExpression: 'set lastUpdatedAt = :now, dataEntryDataIndicated = :dataEntryDataIndicated, recordStatus = :recordStatus, pageUpdateResults = :pageUpdateResults',
        ConditionExpression: 'attribute_exists(importBatchGuid)',
        ExpressionAttributeValues: {
            ':dataEntryDataIndicated': true,
            ':now': new Date().getTime(),
            ':recordStatus': ImportBatchRecordStatus.PendingProcessing.toString(),
            ':pageUpdateResults': pageUpdateResults
        },
        ReturnValues: 'ALL_NEW'
    }).promise();
    
    let updatedRecord = updateResult.Attributes as ImportBatchRecord;
    await updateBatchCounts(importBatchGuid);

    return updatedRecord;
}


async function updateBatchCounts(importBatchGuid:string) {
    let records = await ImportBatchRecordDAO.getBatchRecordStatuses(importBatchGuid);

    var statusCounts:{[name:string]:number} = {};
    for (let record of records) {
        if (record.recordStatus) {
            if (!_.has(statusCounts, record.recordStatus))
                statusCounts[record.recordStatus] = 0;
            statusCounts[record.recordStatus]++;
        }
    }
    
    await setBatchStatusCounts(importBatchGuid, records, statusCounts);
}

async function setBatchStatusCounts(importBatchGuid:string, records:RecordStatusResult[], statusCounts:{[name:string]:number}) {

    let batchComplete = false;
    let batchPendingReview = false;
    if(records.length == 0) {
        batchComplete = true;
        batchPendingReview = false;
    }
    else {
        batchComplete = isBatchComplete(records, statusCounts);
        batchPendingReview = isBatchPendingReview(records, statusCounts);
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

    await ddb.createDocClient().update(params).promise();
}

function isBatchComplete(importBatchRecords:RecordStatusResult[], statusCounts:{[name:string]:number}) {
    // The batch is considered complete if all the records are in 
    // eitehr processing_complete, discarded or rejected status.
    var totalRecords = importBatchRecords.length;
    return ((statusCounts.processing_complete || 0) +
            (statusCounts.discarded || 0) + 
            (statusCounts.ignored || 0)) 
            == totalRecords;
}

function isBatchPendingReview(importBatchRecords:RecordStatusResult[], statusCounts:{[name:string]:number}) {
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

export async function discardExternalWebFormRecord(importBatchGuid:string, recordIndex:number, reason:string) {
    let importBatchRecord = await ImportBatchRecordDAO.getBatchRecord(importBatchGuid, recordIndex);
    if(importBatchRecord.recordDataType != ImportBatchRecordDataType.ExternalWebForm) {
        throw new Error('This record is not from an external web form.');
    }

    let updateResult = await ddb.createDocClient().update({
        TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
        Key: {
            importBatchGuid: importBatchGuid,
            recordIndex: recordIndex
        },
        UpdateExpression: 'set lastUpdatedAt = :now, recordStatus = :discarded, discardReason = :reason',
        ConditionExpression: 'attribute_exists(importBatchGuid)',
        ExpressionAttributeValues: {
            ':now': new Date().getTime(),
            ':discarded': 'discarded',
            ':reason': reason
        },
        ReturnValues: 'ALL_NEW'
    }).promise();
    await updateBatchCounts(importBatchGuid);
    return updateResult.Attributes as ImportBatch;
}

export function isRecordProcessable(importBatchRecord):boolean {
    return importBatchRecord.recordStatus == 'pending_processing' || 
        (importBatchRecord.recordStatus == 'processing' && moment().diff(moment(importBatchRecord.processingStartedAt), 'seconds') > 5) ||
        importBatchRecord.recordStatus == 'processing_failed';
}

function generateSuccessfulRecordProcessingAuditEvent(importBatchRecord, scriptResult:ImportBatchRecordProcessingResult) {
    return {
        eventType: 'record_processing_succeeded',
        importBatchGuid: importBatchRecord.importBatchGuid,
        importBatchRecordGuid: importBatchRecord.importBatchGuid,
        importBatchGuidRecordIndex: importBatchRecord.importBatchGuid + ':' + importBatchRecord.recordIndex,
        orgInternalName: importBatchRecord.importBatch.orgInternalName,
        eventData: {
            flowResult: scriptResult.result
        }
    }
}

function generateFailedRecordProcessingAuditEvent(importBatchRecord, scriptResult:ImportBatchRecordProcessingResult) {
    return {
        eventType: 'record_processing_failed',
        importBatchGuid: importBatchRecord.importBatchGuid,
        importBatchRecordGuid: importBatchRecord.importBatchGuid,
        importBatchGuidRecordIndex: importBatchRecord.importBatchGuid + ':' + importBatchRecord.recordIndex,
        orgInternalName: importBatchRecord.importBatch.orgInternalName,
        eventData: {
            reason: scriptResult.errorMessage,
            errorStack: scriptResult.errorStack,
            flowResult: scriptResult.result
        }
    }
}

export async function processImportBatchRecord(importBatchGuid:string, recordIndex:number, tl:any = null):Promise<ImportBatchRecordProcessingResult> {

    // Retrieve flow, and import batch and import batch record from ddb.
    
    let importBatchRecord;
    let importBatch;
    try {
        //console.log('Retrieving import batch and record.');
        importBatchRecord = await ImportBatchDAO.getBatchRecord(importBatchGuid, recordIndex, true, true);
        importBatch = await ImportBatchDAO.getBatchByGuid(importBatchGuid);
        //console.log('Retrieved.');
    }
    catch(error) {
        return {
            hasError: true,
            errorMessage: 'Unable to retrieve batch and records: ' + error.message,
            errorStack: error.stack
        }
    }

    if(!importBatch.flowGuid) {
        return {
            hasError:true,
            errorMessage: 'Import batch does not specify a flow script for processing.'
        }
    }

    let flow = await FlowDAO.getFlow(importBatch.flowGuid);
    importBatchRecord.importBatch = importBatch;
    
    // We need to check if we are executing a flow that is either global or assigned to this org. We also make sure the
    // import batch record is in the correct status.
    if(!flow.systemGlobal && flow.orgInternalName != importBatchRecord.orgInternalName) {
        return {
            hasError: true,
            errorMessage: 'Unable to process record with flow script for incorrect organization.'
        };
    }
    
    if(flow.systemGlobal) {
        flow.orgInternalName = importBatchRecord.orgInternalName;
    }
    
    if(!isRecordProcessable(importBatchRecord)) {
        return {
            hasError: true,
            errorMessage: 'Unable to process record, not in correct status.'
        };
    }
    //console.log('Indicating record processing.');
    // Indicate that the record is in the 'processing' state.
    await ImportBatchDAO.indicateRecordProcessing(importBatchRecord.importBatchGuid, importBatchRecord.recordIndex);
    
    // Run the flow script with the import batch record as the payload.
    let scriptResult: ImportBatchRecordProcessingResult;
    try {
        //console.log('Executing flow with import batch record.');
        //console.log(JSON.stringify(importBatchRecord,null,4));
        let flowScriptRunner = new FlowScript(flow, importBatchRecord, tl ? tl.transactionId : null);
        let flowScriptResult = await flowScriptRunner.run();
        //console.log('Flow runner result:');
        //console.log(flowScriptResult);
        if(!_.isPlainObject(scriptResult)) {
            scriptResult = {
                result: flowScriptResult,
                flowGuid: flow.flowGuid,
                flowVersion: flow.version
            };
        }
        else {
            scriptResult = flowScriptResult.scriptResult;
        }
    }
    catch(error) {
        // If running flow script causes an error, let's mark this record processing as having failed.
        scriptResult = {
            hasError: true,
            errorMessage: error.message || 'Unknown failure reason.',
            errorStack: error.stack
        }

        if(error.isScriptError) {
            scriptResult.result = error.result;
        }
    }
    
    scriptResult.flowGuid = flow.flowGuid;
    scriptResult.flowVersion = flow.version;

    if(flow.systemFlowScriptContent) {
        scriptResult.systemFlowScriptGuid = flow.systemFlowScriptContent.systemFlowScriptGuid;
        scriptResult.systemFlowScriptVersion = flow.systemFlowScriptContent.version;
    }

    // Generate an audit event for this processing result.
    let auditEvent;
    if(scriptResult.hasError) {
        auditEvent = generateFailedRecordProcessingAuditEvent(importBatchRecord, scriptResult);
    }
    else {
        auditEvent = generateSuccessfulRecordProcessingAuditEvent(importBatchRecord, scriptResult);
    }
    await ImportEventDAO.createEvent(auditEvent);

    // Now mark the import batch record has having been complete or failed.       
    var importBatchRecordProcessingData = {
        flowGuid: scriptResult.flowGuid || null,
        flowVersion: scriptResult.flowVersion || null,
        systemFlowScriptGuid: scriptResult.systemFlowScriptGuid || null,
        systemFlowScriptVersion: scriptResult.systemFlowScriptVersion || null,
        encounterId: null,
        encounterFormId: null,
        facilityId: null
    };

    if(scriptResult.recordImportResult) {
        importBatchRecordProcessingData.encounterId = scriptResult.recordImportResult.encounterId;
        importBatchRecordProcessingData.encounterFormId = scriptResult.recordImportResult.encounterFormId;
        importBatchRecordProcessingData.facilityId = scriptResult.recordImportResult.facilityId;
    }

    if(scriptResult.hasError) {
        await ImportBatchDAO.indicateRecordProcessingFailed(importBatchRecord.importBatchGuid, importBatchRecord.recordIndex, scriptResult.errorMessage || 'Unknown failure reason.', importBatchRecordProcessingData);
    }
    else {
        await ImportBatchDAO.indicateRecordProcessingComplete(importBatchRecord.importBatchGuid, importBatchRecord.recordIndex, importBatchRecordProcessingData);
    }

    return scriptResult;
}

export async function updateImportBatchFacility(importBatchGuid:string, newFacilityId:number):Promise<any> {
    let batch:ImportBatch = await ImportBatchDAO.getBatchByGuid(importBatchGuid, false, true);

    //console.log('Updating batch facility ID.');
    await ddb.createDocClient().update({
        TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
        Key: {
            importBatchGuid: importBatchGuid
        },
        UpdateExpression: 'set facilityId = :facilityId, lastUpdatedAt = :now',
        ConditionExpression: 'attribute_exists(importBatchGuid)',
        ExpressionAttributeValues: {
            ':facilityId': newFacilityId,
            ':now': new Date().getTime()
        }
    }).promise();

    for(let record of batch.records) {
        //console.log(' - Updating batch record ' + record.recordIndex + '/' + batch.records.length);
        let updateResult = await ddb.createDocClient().update({
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
            Key: {
                importBatchGuid: importBatchGuid,
                recordIndex: record.recordIndex
            },
            UpdateExpression: 'set lastUpdatedAt = :now, facilityId = :facilityId',
            ConditionExpression: 'attribute_exists(importBatchGuid)',
            ExpressionAttributeValues: {
                ':now': new Date().getTime(),
                ':facilityId': newFacilityId
            },
            ReturnValues: 'ALL_NEW'
        }).promise();
    }
}

export async function getUpdatedImportBatchRecords(orgInternalName:string, startDate:string, endDate:string, timezone?:string):Promise<ImportBatchRecord[]> {

    if(!timezone) timezone = "America/Chicago";
    
    var searchParameters: Elasticsearch.SearchParams = {
        index: "import_events_v1",
        body: {
            "size": 100000,
            "_source": ["importBatchRecordGuid","importBatchGuid","lastUpdatedAt","recordIndex"], 
            "query": {
              "bool": {
                "must": [
                  {
                    "match": {
                      "_type": {
                        "query": "import_batch_record",
                        "type": "phrase"
                      }
                    }
                  },
                  {
                    "match": {
                      "orgInternalName": {
                        "query": orgInternalName,
                        "type": "phrase"
                      }
                    }
                  },
                  {
                    "range": {
                      "lastUpdatedAt": {
                        "gte": startDate,
                        "lte": endDate,
                        "time_zone": timezone
                      }
                    }
                  }
                ]
              }
            },
            "sort": [
              {
                "lastUpdatedAt": {
                  "order": "desc"
                }
              }
            ]
        }
    };
    
    let queryResults = await es.createCollectorClient().search(searchParameters);
    type UpdatedImportBatchRecordResult = { importBatchGuid:string, importBatchRecordGuid:string, recordIndex:number, lastUpdatedAt:number };
    let updatedImportBatcheRecords = <UpdatedImportBatchRecordResult[]> queryResults.hits.hits.map((r) => r._source);

//    let retrievedCount = 0;
//    console.log('Retrieving all records from DDB and S3 (' + updatedImportBatcheRecords.length + '):');
    let importBatchRecords = await Bluebird.map(updatedImportBatcheRecords, (updatedRecord) => {
//        retrievedCount++;
//        console.log('Retrieved record ' + retrievedCount + '/' + updatedImportBatcheRecords.length);
        return ImportBatchRecordDAO.getBatchRecord(updatedRecord.importBatchGuid,updatedRecord.recordIndex, true, true);
    }, { concurrency: 1000 });
    
    return importBatchRecords;
}