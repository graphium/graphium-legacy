
import FacilitySetting from '../model/flow/FacilitySetting';

var AWS = require('aws-sdk');
var uuid = require('uuid');
var winston = require('winston');
var https = require('https');
var _ = require('lodash');
var Joi = require('joi');
var ddb = require('../util/ddbUtil.js');
import { EnvironmentConfig } from '../config/EnvironmentConfig';

var createDynamoDbDocClient = function() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

export async function getSetting(orgInternalName, facilityId, settingName):Promise<FacilitySetting> {

    return new Promise<FacilitySetting>(function(resolve, reject) {

        if(!_.isString(orgInternalName)) {
            return Promise.reject(new Error('Unable to retrieve facility setting, orgInternalName is not set.'));
        }

        if(!_.isInteger(facilityId)) {
            return Promise.reject(new Error('Unable to retrieve facility setting, facilityId is not set.'));
        }

        if(!_.isString(settingName)) {
            return Promise.reject(new Error('Unable to retrieve facility setting, settingName is not set.'));
        }

        if(settingName.indexOf(':') >= 0) {
            return Promise.reject(new Error('Setting name cannot contain a colon.'));
        }

        var settingKey = [settingName,orgInternalName,facilityId.toString()].join(':');

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_FACILITY_SETTING'),
            KeyConditionExpression: "settingKey = :settingKey",
            ExpressionAttributeValues: {
                ":settingKey": settingKey
            }
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items.length > 0 ? data.Items[0] : null);
        });
    })
}

export async function getAllSettingsForOrg(orgInternalName, settingName):Promise<FacilitySetting[]> {
    return new Promise<FacilitySetting[]>(function(resolve, reject) {

        if(!_.isString(orgInternalName)) {
            return Promise.reject(new Error('Unable to retrieve facility setting, orgInternalName is not set.'));
        }

        if(!_.isString(settingName)) {
            return Promise.reject(new Error('Unable to retrieve facility setting, settingName is not set.'));
        }

        if(settingName.indexOf(':') >= 0) {
            return Promise.reject(new Error('Setting name cannot contain a colon.'));
        }

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_FACILITY_SETTING'),
            FilterExpression : 'begins_with(settingKey, :settingKey)',
            ExpressionAttributeValues : {':settingKey' : [settingName,orgInternalName].join(':')}
        };

        var docClient = ddb.createDocClient();
        docClient.scan(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items);
        });
    })
}

export async function getAllSettingsByName(settingName):Promise<FacilitySetting[]> {
    return ddb.queryAll( 
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_FACILITY_SETTING'), 
        EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_FACILITY_SETTING_SETTING_NAME_IDX'),
        "settingName = :settingName",
        { ":settingName" : settingName } 
    );
}

export async function putSetting(orgInternalName, facilityId, settingName, settingValue) {
    return new Promise(function(resolve, reject) {

        if(!_.isString(orgInternalName)) {
            return Promise.reject(new Error('Unable to set facility setting, orgInternalName is not set.'));
        }

        if(!_.isInteger(facilityId)) {
            return Promise.reject(new Error('Unable to set facility setting, facilityId is not set.'));
        }

        if(!_.isString(settingName)) {
            return Promise.reject(new Error('Unable to set facility setting, settingName is not set.'));
        }

        if(!_.isString(settingValue)) {
            return Promise.reject(new Error('Unable to set facility setting, settingValue is not a string.'));
        }

        if(settingName.indexOf(':') >= 0) {
            return Promise.reject(new Error('Setting name cannot contain a colon.'));
        }

        var settingKey = [settingName,orgInternalName,facilityId.toString()].join(':');
        var now = Date.now();

        var docClient = ddb.createDocClient();
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_FACILITY_SETTING'),
            Key: {
                settingKey: settingKey
            },
            UpdateExpression: 'set settingValue = :settingValue,' +
                                  'orgInternalName = if_not_exists(orgInternalName, :orgInternalName),' +
                                  'facilityId = if_not_exists(facilityId, :facilityId),' +
                                  'settingName = if_not_exists(settingName, :settingName),' +
                                  'createdAt = if_not_exists(createdAt, :now),' +
                                  'lastUpdatedAt = :now',
            ExpressionAttributeValues: {
                ':orgInternalName': orgInternalName,
                ':facilityId': facilityId,
                ':settingValue': settingValue,
                ':settingName': settingName,
                ':now': now
            }
        };
        
        docClient.update(params, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve(null);
            }
        });
    });
}

