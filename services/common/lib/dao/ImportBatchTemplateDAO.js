var Promise = require('bluebird');
var uuid = require('uuid');
var winston = require('winston');
var _ = require('lodash');
var Joi = require('joi');
var ddb = require('../util/ddbUtil.js');
var s3 = require('../util/s3Util.js');
var FlowDAO = require('./FlowDAO.js');

function validateTemplate(template) {
    var schema = {
        templateGuid: Joi.string().guid().required(),
        orgInternalName: Joi.when('systemGlobal', {
            is: true,
            then: Joi.allow(null),
            otherwise: Joi.string().required()
        }),
        templateName: Joi.string().required(),
        templateDescription: Joi.string().optional().allow(null),
        batchDataType: Joi.string().valid(['pdf','dsv','hagy','hcaAdvantx','medaxion']).required(),
        batchDataTypeOptions: Joi.when('batchDataType', {
            is:'dsv',
            then: Joi.object().keys({
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
        defaultAssigneeUserName: Joi.when('systemGlobal', {
            is: true,
            then: Joi.allow(null),
            otherwise: Joi.string().optional().allow(null)
        }),
        requiresDataEntry: Joi.boolean().required(),
        dataEntryFormDefinitionName: Joi.when('requiresDataEntry', {is:true, then: Joi.string().required(), otherwise: Joi.allow(null).required()}),
        flowScriptGuid: Joi.string().guid().required(),
        lastUpdatedAt: Joi.number().required(),
        createdAt: Joi.number().required(),
        activeIndicator: Joi.boolean().required(),
        systemGlobal: Joi.boolean().optional().allow(null)
    }

    var validationResult = Joi.validate(template, schema, {
        abortEarly: false,
        convert: false
    });
    if (validationResult.error) {
        var error = new Error('Import template is invalid.');
        console.log(validationResult);
        error.validationError = validationResult.error;
        throw error;
    }
}

function getTemplatesForOrg(orgInternalName) {
    var allTemplates;
    return new Promise(function(resolve, reject) {
        var params = {
            TableName: process.env.DDB_TABLE_IMPORT_BATCH_TEMPLATE,
            IndexName: process.env.DDB_TABLE_IMPORT_BATCH_ORG_NAME_IDX,
            KeyConditionExpression: "orgInternalName = :orgInternalName and createdAt > :zero",
            ExpressionAttributeValues: {
                ":orgInternalName": orgInternalName,
                ":zero": 0
            }
        };

        var docClient = ddb.createDocClient();
        docClient.query(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Items);
        });
    })
    .then(function(orgTemplates) {
        allTemplates = _.concat(allTemplates, orgTemplates);
        return getSystemTemplates();
    })
    .then(function(systemTemplates) {
        allTemplates = _.concat(allTemplates, systemTemplates);
        return Promise.resolve(_.compact(allTemplates));
    })

}

function getSystemTemplates() {
    return ddb.scanAll(
        process.env.DDB_TABLE_IMPORT_BATCH_TEMPLATE,
        "systemGlobal = :true",
        {
            ":true": true
        });
}

function createTemplate(template) {
    template.createdAt = Date.now();
    template.lastUpdatedAt = Date.now();
    template.templateGuid = uuid.v4();

    try {
        validateTemplate(template);
    }
    catch(error) {
        return Promise.reject(error);
    }

    return FlowDAO.getFlow(template.flowScriptGuid)
    .then(function(flowScript) {
        if(flowScript.orgInternalName != null && flowScript.orgInternalName != template.orgInternalName) {
            return Promise.reject(new Error('Unable to create template, attempting to associate an invalid flow script with template.'));
        }
        else if(flowScript.streamType != 'collector') {
            return Promise.reject(new Error('Unable to create template, specified flow script is not compatible with import batches.'));
        }
        else {
            return ddb.putUnique(process.env.DDB_TABLE_IMPORT_BATCH_TEMPLATE, template, "templateGuid")
            .then(function() {
                return Promise.resolve(template);
            });
        }
    });
}

// Probably need to do more validation here.
function updateTemplate(template) {

    return FlowDAO.getFlow(template.flowScriptGuid)
    .then(function(flow) {

        if(template.systemGlobal && !flow.systemGlobal) {
            return Promise.reject(new Error('Unable to set a global template\'s flow script to a script that is not global.'));
        }
        return _performUpdate(template);
    });
}

function _performUpdate(template) {
    return new Promise(function (resolve, reject) {
        var params = {
            TableName: process.env.DDB_TABLE_IMPORT_BATCH_TEMPLATE,
            Key: {
                templateGuid: template.templateGuid
            },
            UpdateExpression: 'set '
                + 'templateName = :templateName,'
                + 'templateDescription = :templateDescription,'
                + 'batchDataType = :batchDataType,'
                + 'requiresDataEntry = :requiresDataEntry,'
                + 'dataEntryFormDefinitionName = :dataEntryFormDefinitionName,'
                + 'flowScriptGuid = :flowScriptGuid,'
                + 'defaultAssigneeUserName = :defaultAssigneeUserName,'
                + 'activeIndicator = :activeIndicator,'
                + 'batchDataTypeOptions = :batchDataTypeOptions,'
                + 'systemGlobal = :systemGlobal,'
                + 'lastUpdatedAt = :now',
            ExpressionAttributeValues: {
                ':templateName': template.templateName,
                ':templateDescription': template.templateDescription || null,
                ':batchDataType': template.batchDataType,
                ':requiresDataEntry': template.requiresDataEntry,
                ':dataEntryFormDefinitionName': template.dataEntryFormDefinitionName,
                ':flowScriptGuid': template.flowScriptGuid,
                ':defaultAssigneeUserName': template.defaultAssigneeUserName,
                ':activeIndicator': template.activeIndicator,
                ':batchDataTypeOptions': template.batchDataTypeOptions || {},
                ':systemGlobal': template.systemGlobal === true ? true : false,
                ':now': Date.now()
            },
            ConditionExpression: 'attribute_exists(templateGuid)'
        };

        // If system global is set to true, then we make sure and remove org internal name from the object in case
        // this update is updating this template from org specific to global.
        if(template.systemGlobal) {
            params.UpdateExpression += ' REMOVE orgInternalName';
        }
        // If system global is set to 'false' in the update, we only allow this update if system global is already null
        // or false. Otherwise you could make a template that is currently global, org specific. Once it is global it will
        // always be global.
        else {
            params.ConditionExpression += ' and (attribute_not_exists(systemGlobal) or systemGlobal = :false)';
            params.ExpressionAttributeValues[':false'] = false;
        }

        console.log('Updating template: ');
        console.log(params);

        var docClient = ddb.createDocClient();
        docClient.update(params, function (err, data) {
            if (err) reject(err);
            else resolve(template);
        });
    });
}

function getTemplate(templateGuid) {
    return ddb.getConsistent(process.env.DDB_TABLE_IMPORT_BATCH_TEMPLATE, "templateGuid", templateGuid);
}

module.exports = {
    getTemplatesForOrg: getTemplatesForOrg,
    updateTemplate: updateTemplate,
    createTemplate: createTemplate,
    getTemplate: getTemplate
};