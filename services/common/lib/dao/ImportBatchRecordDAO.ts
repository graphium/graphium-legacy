import * as _ from 'lodash';

import * as ddb from '../util/DynamoHelper';
import * as s3 from '../util/s3Util';

import { ImportBatchRecord, ImportBatchRecordStatus, ImportBatchRecordDataType, ExternalWebFormData, DsvRowData, PdfBitmapPageData, RecordDataTypes } from "../model/collector/ImportBatchRecord";
import ImportBatch, { ImportBatchStatus } from '../model/collector/ImportBatch';
import { ExpressionAttributeValueMap } from 'aws-sdk/clients/dynamodb';
import { EnvironmentConfig } from '../config/EnvironmentConfig';

export async function saveS3ImportBatchRecordData(importBatchRecordGuid:string, recordData:RecordDataTypes) {
    await s3.putObjectUnique(
        EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_DATA'), 
        importBatchRecordGuid, 
        JSON.stringify(recordData));
}

export async function saveS3ImportBatchRecordDataEntryData(importBatchGuid:string, recordIndex:number, dataEntryData: {[name:string]:any}) {
    var key = importBatchGuid + ':' + recordIndex;
    await s3.putObject(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_DATA_ENTRY'), key, dataEntryData);
}

export async function retrieveS3ImportBatchData(importBatchGuid:string) {
    return s3.getObjectBody(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_DATA'), importBatchGuid);
}

export async function retrieveS3ImportBatchRecordData<T extends RecordDataTypes>(importBatchRecordGuid:string):Promise<T> {
    let recordDataString:string = await s3.getObjectBody(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_DATA'), importBatchRecordGuid);
    return JSON.parse(recordDataString) as T;
}

export async function retrieveS3ImportBatchRecordDataEntryData(importBatchGuid:string, recordIndex:number):Promise<{[name:string] : any}> {
    try {
        let objectBody:string = await s3.getObjectBody(EnvironmentConfig.getProperty('collector-v1','S3_IMPORT_BATCH_RECORD_DATA_ENTRY'), importBatchGuid + ':' + recordIndex)
        return JSON.parse(objectBody);
    }
    catch(error) {
        // Swallow no such key, as sometimes data entry hasn't occured yet
        // so we may not have data to return.
        if(error.code !== 'NoSuchKey') {
            throw(error);
        }
        else {
            return {};
        }
    }
}

export async function createImportBatchRecordDynamo(importBatchRecord:ImportBatchRecord) {
    let cleansedRecord = _.clone(importBatchRecord);
    delete cleansedRecord.dataEntryData;
    delete cleansedRecord.recordData;

    await ddb.putUnique(EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'), cleansedRecord, 'importBatchRecordGuid' );
}


export async function createImportBatchDynamo(importBatch:ImportBatch) {
    // We make sure and don't persist the batchData object to ddb.
    var cleanedDdbInstance = _.clone(importBatch) as ImportBatch;
    delete cleanedDdbInstance.batchData;

    // Now persist the data to dynamo.
    await ddb.putUnique(EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'), cleanedDdbInstance, "importBatchGuid");
}

export async function getBatchRecordDynamo(importBatchGuid:string, recordIndex:number):Promise<ImportBatchRecord> {
    let result = await ddb.createDocClient().query({
        TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
        KeyConditionExpression: "importBatchGuid = :importBatchGuid and recordIndex = :recordIndex",
        ExpressionAttributeValues: {
            ":importBatchGuid": importBatchGuid,
            ":recordIndex": recordIndex
        },
        ConsistentRead: true
    }).promise();
    
    if(result.Items && result.Items.length == 1) {
        return result.Items[0] as ImportBatchRecord;
    }
    else {
        return null;
    }
}

async function getBatchDynamo(importBatchGuid:string):Promise<ImportBatch> {
    let result = await ddb.createDocClient().query({
        TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
        KeyConditionExpression: "importBatchGuid = :importBatchGuid",
        ExpressionAttributeValues: {
            ":importBatchGuid": importBatchGuid
        },
        ConsistentRead: true
    }).promise();
    
    if(result.Items && result.Items.length == 1) {
        return result.Items[0] as ImportBatch;
    }
    else {
        return null;
    }
}


export interface RecordStatusResult {
    recordStatus:ImportBatchRecordStatus, 
    importBatchGuid:string,
    importBatchRecordGuid: string,
    recordIndex: number
}
export async function getBatchRecordStatuses(importBatchGuid:string):Promise<RecordStatusResult[]> {
    return await ddb.queryAll<RecordStatusResult>(<AWS.DynamoDB.DocumentClient.QueryInput>{
        TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
        KeyConditionExpression: "importBatchGuid = :importBatchGuid AND recordIndex >= :zero",
        ExpressionAttributeValues: {
            ":importBatchGuid": importBatchGuid,
            ":zero": 0
        },
        ConsistentRead: true,
        ProjectionExpression: "recordStatus, importBatchGuid, importBatchRecordGuid, recordIndex"
    });
}

export async function getMaxRecordIndex(importBatchGuid:string):Promise<number> {
    let recordStatuses = await getBatchRecordStatuses(importBatchGuid);

    if(!recordStatuses || recordStatuses.length == 0) {
        return -1;
    }
    else {
        let recordWithMaxIndex = _.maxBy(recordStatuses, 'recordIndex');
        return recordWithMaxIndex.recordIndex;
    }
}

/*
 *  Public methods.
 */

/*
interface CreateBatchRecordRequest {
    importBatchRecordGuid: string;
    searchKey?: string;
    orgInternalName: string;
    facilityId: number;
    recordDataType: ImportBatchRecordDataType;
    recordData: RecordDataTypes;
    recordIndex: number;
    recordOrder: number;
    recordStatus: ImportBatchRecordStatus;
    notes?: string[];
    dataEntryBy?: string[],
    dataEntryData?: { [name: string]: any };
    createdAt: number;
    lastUpdatedAt: number;
    completedAt?: number;
    dataEntryErrorFields: string[],
    dataEntryInvalidFields: string[],
    dataEntryDataIndicated: boolean,
    responsibleProviderIds?: number[],
    primaryResponsibleProviderId?: number,
    discardReason?: string,
    pageUpdateResults?: {[pageName:string]: {
        lastUpdated: number,
        reporterName: string
    }}
}
export async function createBatchRecord(request:CreateBatchRecordRequest):Promise<ImportBatchRecord> {
    let now = new Date().getTime();
    let maxRecordIndex = await getMaxRecordIndex(request.importBatchGuid);
    let record = <ImportBatchRecord>{
        importBatchRecordGuid: uuid.v4(),
        searchKey: request.searchKey,
        importBatchGuid: request.importBatchGuid,
        orgInternalName: request.orgInternalName,
        facilityId: request.facilityId,
        recordDataType: ImportBatchRecordDataType.ExternalWebForm,
        recordData: request.recordData,
        recordStatus: ImportBatchRecordStatus.PendingDataEntry,
        recordIndex: maxRecordIndex + 1,
        recordOrder: maxRecordIndex + 1,
        dataEntryBy: [],
        createdAt: now,
        lastUpdatedAt: now,
        dataEntryDataIndicated: false,
        dataEntryErrorFields: [],
        dataEntryInvalidFields: [],
        notes: []
    }

    validateNewImportBatchRecord(record);

    await createImportBatchRecordDynamo(record);
    await saveS3ImportBatchRecordData(record.importBatchRecordGuid, record.recordData);
    return record;
}
*/
 

export async function getBatchRecord(importBatchGuid:string, recordIndex:number, withRecordData?:boolean, withDataEntryData?:boolean):Promise<ImportBatchRecord> {
    let record = await getBatchRecordDynamo(importBatchGuid, recordIndex);

    if(record && withRecordData === true) {
        record.recordData = await retrieveS3ImportBatchRecordData<RecordDataTypes>(record.importBatchRecordGuid);
    }

    if(record && withDataEntryData === true) {
        record.dataEntryData = await retrieveS3ImportBatchRecordDataEntryData(record.importBatchGuid, record.recordIndex);
    }

    return record;
}

export async function getBatch(importBatchGuid:string):Promise<ImportBatch> {
    let batch = await getBatchDynamo(importBatchGuid);
    return  batch;
}


export async function findActiveBatchByKey(orgInternalName:string, searchKey:string):Promise<ImportBatch> {
    let batches = await getBatchesByKey(orgInternalName, searchKey);
    let batch = batches.find((b) => { return b.batchStatus != ImportBatchStatus.Discarded});
    return batch;
}

export async function getBatchesByKey(orgInternalName:string, searchKey:string):Promise<ImportBatch[]> {
    return ddb.queryAll<ImportBatch>(
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH'),
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_SEARCH_KEY_IDX'),
        "searchKey = :searchKey AND orgInternalName  = :orgInternalName",
        <ExpressionAttributeValueMap>{ 
            ":searchKey" : searchKey,
            ":orgInternalName": orgInternalName
        });
}

export async function findActiveRecordByKey(orgInternalName:string, searchKey:string, withRecordData?:boolean, withDataEntryData?:boolean):Promise<ImportBatchRecord> {
    let matchedRecords = await getBatchRecordsBySearchKey(orgInternalName, searchKey);
    let record = matchedRecords.find((ibr) => { return ibr.recordStatus != ImportBatchRecordStatus.Discarded });

    if(record && withRecordData === true) {
        record.recordData = await retrieveS3ImportBatchRecordData<RecordDataTypes>(record.importBatchRecordGuid);
    }

    if(record && withDataEntryData === true) {
        record.dataEntryData = await retrieveS3ImportBatchRecordDataEntryData(record.importBatchGuid, record.recordIndex);
    }

    return record;
}

export async function getBatchRecordsBySearchKey(orgInternalName:string, searchKey:string):Promise<ImportBatchRecord[]> {
    return ddb.queryAll<ImportBatchRecord>(
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD_SEARCH_KEY_IDX'),
        "searchKey = :searchKey AND orgInternalName = :orgInternalName",
        { 
            ":searchKey" : searchKey,
            ":orgInternalName": orgInternalName
        } );
}

export async function getBatchRecordsBySecondarySearchKey(orgInternalName:string, secondarySearchKey:string, withRecordData:boolean = false, withDataEntryData:boolean = false):Promise<ImportBatchRecord[]> {

    let records = await ddb.queryAll<ImportBatchRecord>(
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD'),
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_IMPORT_BATCH_RECORD_SECONDARY_SEARCH_KEY_IDX'),
        "secondarySearchKey = :secondarySearchKey AND orgInternalName = :orgInternalName",
        { 
            ":secondarySearchKey" : secondarySearchKey,
            ":orgInternalName": orgInternalName
        } );
    
    for(let record of records) {
        if(record && withRecordData === true) {
            record.recordData = await retrieveS3ImportBatchRecordData<RecordDataTypes>(record.importBatchRecordGuid);
        }

        if(record && withDataEntryData === true) {
            record.dataEntryData = await retrieveS3ImportBatchRecordDataEntryData(record.importBatchGuid, record.recordIndex);
        }
    }

    return records;
}
