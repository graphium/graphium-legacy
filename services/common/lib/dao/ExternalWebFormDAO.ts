
import FacilitySetting from '../model/flow/FacilitySetting';
import ExternalWebForm from '../model/flow/ExternalWebForm';

var AWS = require('aws-sdk');
var uuid = require('uuid');
var winston = require('winston');
var https = require('https');
var _ = require('lodash');
var Joi = require('joi');

import * as ddb from '../util/DynamoHelper';
import { ExpressionAttributeValueMap } from 'aws-sdk/clients/dynamodb';
import ImportBatch from '../model/collector/ImportBatch';
import ImportBatchRecord from '../model/collector/ImportBatchRecord';

var createDynamoDbDocClient = function():AWS.DynamoDB.DocumentClient {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

export async function createForm(params:{

}) {
    return null;
}


export async function getExternalWebFormRecords(externalWebFormGuid:string):Promise<ImportBatchRecord[]> {
    let externalWebFormDefinition = await getForm(externalWebFormGuid);
    let searchKeyPrefix = externalWebFormDefinition.orgInternalName + '_' + externalWebFormDefinition.facilityId + '_' + externalWebFormDefinition.externalWebFormGuid + '_';

    let data = await ddb.queryAll<ImportBatchRecord>(
        process.env.DDB_TABLE_IMPORT_BATCH_RECORD,
        process.env.DDB_TABLE_IMPORT_BATCH_ORG_SEARCHKEY_IDX,
        "orgInternalName = :orgInternalName and begins_with (searchKey, :searchKeyPrefix)",
        <ExpressionAttributeValueMap>{ 
            ":orgInternalName": externalWebFormDefinition.orgInternalName,
            ":searchKeyPrefix": searchKeyPrefix
    });

    return data;
}

export async function getForm(externalWebFormGuid:string):Promise<ExternalWebForm> {

    if(!_.isString(externalWebFormGuid)) {
        return Promise.reject(new Error('Unable to retrieve form, externalWebFormGuid is not set.'));
    }

    var params = {
        TableName: process.env.DDB_TABLE_EXTERNAL_WEB_FORM,
        KeyConditionExpression: "externalWebFormGuid = :externalWebFormGuid",
        ExpressionAttributeValues: {
            ":externalWebFormGuid": externalWebFormGuid
        }
    };

    var docClient = createDynamoDbDocClient();
    
    let data = await docClient.query(params).promise();
    return data.Items && data.Items.length > 0 ? data.Items[0] as ExternalWebForm : null;
}

export async function getFormDefinitionsForOrg(orgInternalName:string):Promise<ExternalWebForm[]> {

    if(!_.isString(orgInternalName)) {
        return Promise.reject(new Error('Unable to retrieve form, orgInternalName is not set.'));
    }

    console.log('Getting external web forms for: ' + orgInternalName);
    let data = await ddb.queryAll<ExternalWebForm>(
        process.env.DDB_TABLE_EXTERNAL_WEB_FORM,
        process.env.DDB_TABLE_EXTERNAL_WEB_FORM_ORG_NAME_IDX,
        "orgInternalName = :orgInternalName",
        <ExpressionAttributeValueMap>{
            ":orgInternalName": orgInternalName
        }
    );
    return data;
}