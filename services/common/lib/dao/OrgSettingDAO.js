var Promise = require('bluebird');
var AWS = require('aws-sdk');
var uuid = require('uuid');
var winston = require('winston');
var https = require('https');
var _ = require('lodash');
var Joi = require('joi');
var ddb = require('../util/ddbUtil.js');

var createDynamoDbDocClient = function() {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

var getSetting = function(orgInternalName, settingName) {

    return new Promise(function(resolve, reject) {

        if(!_.isString(orgInternalName)) {
            return Promise.reject(new Error('Unable to retrieve organization setting, orgInternalName is not set.'));
        }

        if(!_.isString(settingName)) {
            return Promise.reject(new Error('Unable to retrieve organization setting, settingName is not set.'));
        }

        if(settingName.indexOf(':') >= 0) {
            return Promise.reject(new Error('Setting name cannot contain a colon.'));
        }

        var settingKey = [settingName,orgInternalName].join(':');

        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_ORG_SETTING'),
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

var putSetting = function(orgInternalName, settingName, settingValue) {
    return new Promise(function(resolve, reject) {

        if(!_.isString(orgInternalName)) {
            return Promise.reject(new Error('Unable to set organization setting, orgInternalName is not set.'));
        }

        if(!_.isString(settingName)) {
            return Promise.reject(new Error('Unable to set organization setting, settingName is not set.'));
        }

        if(!_.isPlainObject(settingValue)) {
            return Promise.reject(new Error('Unable to set organization setting, settingValue is not an object.'));
        }

        if(settingName.indexOf(':') >= 0) {
            return Promise.reject(new Error('Setting name cannot contain a colon.'));
        }

        var settingKey = [settingName,orgInternalName].join(':');
        var now = Date.now();

        var docClient = ddb.createDocClient();
        var params = {
            TableName: EnvironmentConfig.getProperty('collector-v1','DDB_TABLE_ORG_SETTING'),
            Key: {
                settingKey: settingKey
            },
            UpdateExpression: 'set settingValue = :settingValue,' +
                                  'orgInternalName = if_not_exists(orgInternalName, :orgInternalName),' +
                                  'settingName = if_not_exists(settingName, :settingName),' +
                                  'createdAt = if_not_exists(createdAt, :now),' +
                                  'lastUpdatedAt = :now',
            ExpressionAttributeValues: {
                ':orgInternalName': orgInternalName,
                ':settingValue': settingValue,
                ':settingName': settingName,
                ':now': now
            }
        };
        
        console.log('Putting setting with params:');
        console.log(JSON.stringify(params,null,4));

        docClient.update(params, function(err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = {
    putSetting: putSetting,
    getSetting: getSetting
};

