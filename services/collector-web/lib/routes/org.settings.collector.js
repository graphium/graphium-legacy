var express = require('express');
var auth = require('../util/authMiddleware');
var router = express.Router();
var _ = require('lodash');
var OrgUserDAO = require('../dao/org/OrgUserDAO.js');
var FacilityDAO = require('../dao/org/FacilityDAO.js');
var ProviderDAO = require('../dao/org/ProviderDAO.js');
var ImportEventDAO = require('../dao/ImportEventDAO.js');
var ImportFaxLineDAO = require('../dao/ImportFaxLineDAO.js');
var FlowDAO = require('../dao/FlowDAO.js');
var InboundMessageInstanceDAO = require('../dao/InboundMessageInstanceDAO.js');
var ImportBatchTemplateDAO = require('../dao/ImportBatchTemplateDAO.js');
var DataEntryFormDefinitionDAO = require('../dao/DataEntryFormDefinitionDAO');
var Promise = require('bluebird');
var moment = require('moment');


function splitAndCleanList(list) {
    if(list) {
        var items = _.map(_.split(list,','), _.trim);
        return !items || items.length == 0 ? null : items;
    }
    return null;
}

router.get('/templates', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    Promise.all([
        ImportBatchTemplateDAO.getTemplatesForOrg(req.session.org),
        FlowDAO.getFlowsForOrg(req.session.org, true),
        OrgUserDAO.getUsersByRoles(req.session.org, ['DATA_ENTRY_ADMIN','DATA_ENTRY_SUPERVISOR']),
        DataEntryFormDefinitionDAO.getFormDefinitionsForOrg(req.session.org)
    ])
    .spread(function(templates, flows, dataEntrySupervisors, dataEntryFormDefinitions) {
        res.render('orgSettings/collector/templates', {
            templates: templates,
            flows: flows,
            dataEntrySupervisors: dataEntrySupervisors,
            dataEntryFormDefinitions: dataEntryFormDefinitions
        })
    })
});

function convertReqBodyToTemplate(req) {
    var template = {
        orgInternalName: req.session.org,
        templateName: req.body.templateName,
        templateDescription: req.body.templateDescription || null,
        requiresDataEntry: req.body.requiresDataEntry == 'on',
        defaultAssigneeUserName: req.body.defaultAssigneeUserName || null,
        dataEntryFormDefinitionName: req.body.requiresDataEntry == 'on' ? req.body.dataEntryFormDefinitionName : null,
        flowScriptGuid: req.body.flowScriptGuid,
        activeIndicator: req.body.active == 'on',
        batchDataTypeOptions: {}
    };

    var isSystemGlobal = req.body.systemGlobal == 'on';
    if(isSystemGlobal) {
        delete template.orgInternalName;
        template.defaultAssigneeUserName = null;
        template.systemGlobal = true;
    }

    if(req.body.batchDataType.indexOf('dsv_') == 0) {
        template.batchDataType = 'dsv';
        template.batchDataTypeOptions.hasHeader = req.body.hasHeader == 'on';
        template.batchDataTypeOptions.skipEmptyLines = req.body.skipEmptyLines == 'on';
        template.batchDataTypeOptions.relaxColumnCount = req.body.relaxColumnCount == 'on';
        template.batchDataTypeOptions.skipLinesWithEmptyValues = req.body.skipLinesWithEmptyValues == 'on';
        template.batchDataTypeOptions.linesToSkip = !isNaN(parseInt(req.body.linesToSkip)) ? parseInt(req.body.linesToSkip) : null;
        template.batchDataTypeOptions.columnNames = splitAndCleanList(req.body.columnNames);
        template.batchDataTypeOptions.columnTitles = splitAndCleanList(req.body.columnTitles);

        switch(req.body.batchDataType) {
            case 'dsv_comma': template.batchDataTypeOptions.delimiter = 'comma'; break;
            case 'dsv_pipe': template.batchDataTypeOptions.delimiter = 'pipe'; break;
            case 'dsv_tab': template.batchDataTypeOptions.delimiter = 'tab'; break;
            case 'dsv_colon':  template.batchDataTypeOptions.delimiter = 'colon'; break;
        }
    }
    else if(req.body.batchDataType == 'pdf') {
        template.batchDataType = 'pdf';
    }
    else if(req.body.batchDataType == 'hagy') {
        template.batchDataType = 'hagy';
    }
    else if(req.body.batchDataType == 'hcaAdvantx') {
        template.batchDataType = 'hcaAdvantx';
    }
    else if(req.body.batchDataType == 'medaxion') {
        template.batchDataType = 'medaxion';
    }

    return template;
}

router.post('/templates', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    var template = convertReqBodyToTemplate(req);

    if(template.systemGlobal && !auth.isGraphiumAdministrator()) {
        req.flash('error','You do not have permission to create global templates.');
        res.redirect('/org/settings/collector/templates');
        return;
    }

    var getUserPromise = template.defaultAssigneeUserName ? OrgUserDAO.getOrgUser(req.session.org, template.defaultAssigneeUserName) : Promise.resolve(null);
    getUserPromise.then(function(user) {
        if(template.defaultAssigneeUserName) {
            if(!user) {
                return Promise.reject(new Error('Default reviewer not found.'));
            }
            else if(!user.activeIndicator) {
                return Promise.reject(new Error('Default reviewer is not an active user.'));
            }
        }
        return ImportBatchTemplateDAO.createTemplate(template)
    })
    .then(function(retrievedTemplate) {
        req.flash('success', 'Created new template \'' + template.templateName + '\'');
        res.redirect('/org/settings/collector/templates');
    })
    .catch(function(error) {
        console.error('Unable to create new template: ' + error.message);
        console.error(error.stack);
        console.error(error.validationError);
        req.flash('error','Unable to create new template: ' + error.message);
        res.redirect('/org/settings/collector/templates');
    })
});

router.post('/templates/:templateGuid', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {

    var template = convertReqBodyToTemplate(req);
    template.templateGuid = req.params.templateGuid;

    ImportBatchTemplateDAO.getTemplate(template.templateGuid)
    .then(function(retrievedTemplate) {
        if(retrievedTemplate.systemGlobal) {
            if(!auth.isGraphiumAdministrator()) {
                req.flash('error', 'Unable to edit template. Only Graphium admininstrators can edit global templates.');
                res.redirect('/org/settings/collector/templates');
            }
            else {
                return Promise.resolve();
            }
        }
        if(retrievedTemplate.orgInternalName != req.session.org) {
            req.flash('error', 'Unable to edit template. That template does not exist for this organization.');
            res.redirect('/org/settings/collector/templates');
        }
        else {
            if(template.defaultAssigneeUserName)
                return OrgUserDAO.getOrgUser(req.session.org, template.defaultAssigneeUserName);
            else
                return Promise.resolve();
        }
    })
    .then(function(user) {
        if(template.defaultAssigneeUserName) {
            if(!user) {
                return Promise.reject(new Error('Default reviewer not found.'));
            }
            else if(!user.activeIndicator) {
                return Promise.reject(new Error('Default reviewer is not an active user.'));
            }
        }

        return ImportBatchTemplateDAO.updateTemplate(template);
    })
    .then(function() {
        req.flash('success', 'Finished updating template.');
        res.redirect('/org/settings/collector/templates');
    })
    .catch(function(error) {
        console.error('Unable to update template: ' + error.message);
        console.error(error.stack);
        req.flash('error','Unable to create new template: ' + error.message);
        res.redirect('/org/settings/collector/templates');
    })
});

module.exports = router;