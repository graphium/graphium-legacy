var express = require('express');
var auth = require('../util/authMiddleware');
var router = express.Router();
var ImportBatchDAO = require('@common/lib/dao/ImportBatchDAO.js');
var multer = require('multer');
var autoReap = require('multer-autoreap');
var upload = multer();
var crypto = require('crypto');
var bigint = require('big-integer');
var templateHelpers = require('../util/templateHelpers');
var roleGroups = require('../util/roleGroups');
var _ = require('lodash');
var uuid = require('uuid');
var OrgUserDAO = require('@common/lib/dao/org/OrgUserDAO.js');
var FacilityDAO = require('@common/lib/dao/org/FacilityDAO.js');
var ProviderDAO = require('@common/lib/dao/org/ProviderDAO.js');
var ImportEventDAO = require('@common/lib/dao/ImportEventDAO.js');
var ImportFaxLineDAO = require('@common/lib/dao/ImportFaxLineDAO.js');
var FlowDAO = require('@common/lib/dao/FlowDAO.js');
var Promise = require('bluebird');
var moment = require('moment');
var InboundMessageInstanceDAO = require('@common/lib/dao/InboundMessageInstanceDAO.js');
var FlowCoreServicesPrivate = require('@common/lib/services/FlowCoreServicesPrivate');
var MessageRequestService = require('@common/lib/dao/MessageRequestService');

/* GET user profile. */
router.get('/scripts', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    Promise.all([
        FacilityDAO.getFacilities(req.session.org),
        FlowDAO.getFlowsForOrg(req.session.org, true),
        FlowDAO.getSystemFlowScripts()
    ])
    .spread(function(facilities, flows, systemFlowScripts) {
        res.render('orgSettings/flow/scripts', {
            facilities: facilities,
            flows: flows,
            systemFlowScripts: systemFlowScripts
        })
    })
});

function splitAndCleanList(list) {
    if(list) {
        return _.map(_.split(list,','), _.trim);
    }
    return [];
}

router.post('/scripts', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {

    console.log(req.body);
    var flow = {
        flowName: req.body.flowName,
        flowDescription: req.body.flowDescription || null,
        orgInternalName: req.session.org,
        streamType: req.body.streamType,
        messageTypes: splitAndCleanList(req.body.messageTypes),
        processingOrderType: 'sync',
        flowType: req.body.flowType,
        scriptLanguage: req.body.scriptLanguage || 'javascript',
        runtimeVersion: req.body.runtimeVersion || '1.0.0',
        defaultHandler: req.body.defaultHandler,
        flowContent: req.body.flowType == 'script' ? req.body.flowContent : req.body.systemFlowScript,
        active: req.body.active == 'on',
        systemGlobal: req.body.systemGlobal == 'on',
        timeout: 300
    }

    if(flow.defaultHandler === "") flow.defaultHandler = null;

    if(flow.systemGlobal && !auth.isGraphiumAdministrator()) {
        console.error('You do not have permission to create global scripts.');
        req.flash('error','You do not have permission to create global scripts.');
        res.redirect('/org/settings/flow/scripts/');
        return;
    }

    // If this is being flagged as system global we remove the org/fac properties
    // just to make sure we pass validation.
    if(flow.systemGlobal) {
        flow.orgInternalName = null;
        flow.facilityId = null;
    }

    if(req.body.facilityId) {
        flow.facilityId = parseInt(req.body.facilityId);
    }

    var getSystemScriptPromise;
    if(flow.flowType == 'system') {
        getSystemScriptPromise = FlowDAO.retrieveSystemFlowScriptByName(req.body.systemFlowScript)
    }
    else {
        getSystemScriptPromise = new Promise.resolve();
    }

    getSystemScriptPromise
    .then(function(systemFlowScript) {

        if(req.body.flowType == 'system') {
            flow.flowConfig = {};
            _.forOwn(req.body, function(value, key) { 
                if(_.startsWith(key,'flowConfig.')) {
                    var configName = _.replace(key, 'flowConfig.', '');
                    var parameterType = getFlowConfigParameterType(systemFlowScript, configName);
                    if( parameterType == 'array') {
                        value = splitAndCleanList(value);
                    }
                    else if(parameterType == 'boolean') {
                        if(value === null || value === undefined || value === '')
                            value == null;
                        else
                            value = value === 'true' || value === true;
                    }
                    else if( parameterType == 'integer') {
                        value = parseInt(value);
                        if(!_.isInteger(value)) {
                            value = null;
                        }
                    }
                    flow.flowConfig[configName] = value;
                }
            });
        }

        return FlowDAO.createFlow(flow);
    })
    .then(function(createdFlow) {
        console.log('Created flow: ');
        console.log(createdFlow);
        res.redirect('/org/settings/flow/scripts/');
    })
    .catch(function(error) {
        console.error('Unable to create flow: ' + error.message);
        console.error(error.stack);
        req.flash('error',error.message);
        res.redirect('/org/settings/flow/scripts/');
    })

});

/* GET user profile. */
router.get('/scripts/:flowGuid', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    Promise.all([
        FacilityDAO.getFacilities(req.session.org),
        FlowDAO.getFlow(req.params.flowGuid),
        FlowDAO.getSystemFlowScripts()
    ])
    .spread(function(facilities, flow, systemFlowScripts) {
        if(!flow.systemGlobal && flow.orgInternalName != req.session.org) {
            res.redirect('/user/restricted');
            return;
        }   

        res.render('orgSettings/flow/script', {
            facilities: facilities,
            flow: flow,
            systemFlowScripts: systemFlowScripts,
            messageInstances: []
        })
    })
});

// I love you StackOverflow http://stackoverflow.com/questions/10834796/validate-that-a-string-is-a-positive-integer
function isPositiveInteger(n) {
    return n >>> 0 === parseFloat(n);
}

function getFlowConfigParameterType(flowOrSystemScript, configName) {
    
    var parameter;
    if(flowOrSystemScript.parameters) {
        parameter = _.find(flowOrSystemScript.parameters, {name:configName});
    } else if(flowOrSystemScript.systemFlowScriptContent && flowOrSystemScript.systemFlowScriptContent.parameters) {
        parameter = _.find(flowOrSystemScript.systemFlowScriptContent.parameters, {name:configName});
    }

    if( parameter )
        return parameter.type;
    return null;
}

router.post('/scripts/:flowGuid/messageRequest', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {

    console.log('Triggering scheduled flow:');
    console.log(req.body);

    FlowDAO.getFlow(req.params.flowGuid)
    .then(function(existingFlow) {

        if(existingFlow.systemGlobal) {
            return Promise.reject(new Error('Triggering system global flow scripts not supported.'));
        }

        if(existingFlow.orgInternalName != req.session.org) {
            return Promise.reject(new Error('User does not have permissions to send message request.'));
        }

        var today = moment();
        var triggerDate = moment(req.body.triggerDate,'MM/DD/YYYY');

        if(existingFlow.messageTypes[0] === 'nightly') {
            var messageContent = {
                date: triggerDate.format('YYYY-MM-DD'),
                time: today.format('HH:mm:ss'),
                dateTime: today.toISOString(),
                yesterday: triggerDate.subtract(1,'days').format('YYYY-MM-DD')
            }
        }
        else if(existingFlow.messageTypes[0] === 'daily1000') {
            var messageContent = {
                date: triggerDate.format('YYYY-MM-DD'),
                time: '10:00:00',
                dateTime: triggerDate.format('YYYY-MM-DD') + 'T10:00:00.000Z',
                yesterday: triggerDate.subtract(1,'days').format('YYYY-MM-DD')
            }
        }
        else if(existingFlow.messageTypes[0] === 'daily0200') {
            var messageContent = {
                date: triggerDate.format('YYYY-MM-DD'),
                time: '02:00:00',
                dateTime: triggerDate.format('YYYY-MM-DD') + 'T02:00:00.000Z',
                yesterday: triggerDate.subtract(1,'days').format('YYYY-MM-DD')
            }
        }
        else {
            req.flash('error','Unable to trigger scheduled flows of type: ' + existingFlow.messageTypes[0]);
            res.redirect('/org/settings/flow/scripts/'+req.params.flowGuid);
            return;
        }

        console.log('Triggering message for date:');
        console.log(messageContent);
        
        var hash = crypto.createHash('md5').update(uuid.v4()).digest("hex");
        var syncStreamHashKey = bigint(hash, 16).toString();

        return MessageRequestService.intakeMessageRequest({
            syncStreamHashKey: syncStreamHashKey,
            streamType: 'scheduled',
            messageType: existingFlow.messageTypes[0],
            order: 0,
            messageContent: messageContent,
            specificFlowGuid: existingFlow.flowGuid,
            messageContentType: 'json',
            orgInternalName: existingFlow.orgInternalName,
            facilityId: existingFlow.facilityId
        });
    })
    .then(function(result) {
        console.log('Completed message intake:\n'+JSON.stringify(result,null,4));
        res.redirect('/org/settings/flow/scripts/'+req.params.flowGuid);
    })
    .catch(function(error) {
        console.error('Unable to intake message request: ' + error.message);
        console.error(error.stack);
        req.flash('error',error.message);
        res.redirect('/org/settings/flow/scripts/'+req.params.flowGuid);
    });
});

router.post('/scripts/:flowGuid', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {

    FlowDAO.getFlow(req.params.flowGuid)
    .then(function(existingFlow) {

        var flow = {
            flowGuid: req.params.flowGuid,
            flowName: req.body.flowName,
            flowDescription: req.body.flowDescription || null,
            streamType: req.body.streamType,
            messageTypes: splitAndCleanList(req.body.messageTypes),
            flowType: req.body.flowType,
            scriptLanguage: req.body.scriptLanguage || 'javascript',
            runtimeVersion: req.body.runtimeVersion || '1.0.0',
            defaultHandler: req.body.defaultHandler,
            flowContent: req.body.flowType == 'script' ? req.body.flowContent : req.body.systemFlowScript,
            timeout: 300,
            active: req.body.active == 'on',
            systemGlobal: req.body.systemGlobal == 'on'
        }

        if(flow.defaultHandler === "") flow.defaultHandler = null;
        
        if(!existingFlow.systemGlobal && existingFlow.orgInternalName != req.session.org) {
            return Promise.reject(new Error('User does not have permissions to edit this script.'));
        }

        if(flow.systemGlobal && !auth.isGraphiumAdministrator()) {
            return Promise.reject(new Error('User is unable to create global flow scripts.'));
        }

        if(existingFlow.systemGlobal && !flow.systemGlobal) {
            return Promise.reject(new Error('User is not allowed to create global flow scripts.'));
        }

        if(isPositiveInteger(req.body.facilityId)) {
            flow.facilityId = parseInt(req.body.facilityId);
        }

        // If this is being flagged as system global we remove the org/fac properties
        // just to make sure we pass validation.
        if(flow.systemGlobal) {
            flow.orgInternalName = undefined;
            flow.facilityId = null;
        }

        if(req.body.flowType == 'system') {
            flow.flowConfig = {};
            _.forOwn(req.body, function(value, key) { 
                if(_.startsWith(key,'flowConfig.')) {
                    var configName = _.replace(key, 'flowConfig.', '');
                    var parameterType = getFlowConfigParameterType(existingFlow, configName);
                    if( parameterType == 'array') {
                        value = splitAndCleanList(value);
                    }
                    else if(parameterType == 'boolean') {
                        if(value === null || value === undefined || value === '')
                            value == null;
                        else
                            value = value === 'true' || value === true;
                    }
                    else if( parameterType == 'integer') {
                        value = parseInt(value);
                        if(!_.isInteger(value)) {
                            value = null;
                        }
                    }
                    flow.flowConfig[configName] = value;
                }
            });
        }


        return FlowDAO.updateFlow(flow);
    })
    .then(function(updatedFlow) {
        console.log('Updated flow: ');
        console.log(updatedFlow);
        res.redirect('/org/settings/flow/scripts/'+req.params.flowGuid);
    })
    .catch(function(error) {
        console.error('Unable to create flow: ' + error.message);
        console.error(error.stack);
        req.flash('error',error.message);
        res.redirect('/org/settings/flow/scripts/');
    })

});

router.get('/scripts/:flowGuid/messages.json', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    FlowDAO.getFlowOrg(req.params.flowGuid)
    .then(function(flowOrg) {
        if(flowOrg != req.session.org) {
            res.status(401).send('Unable to retrieve messages for flow. User not authorized.');
        }
        else {
            return InboundMessageInstanceDAO.getMessageInstancesForFlow(req.params.flowGuid);
        }
    })
    .then(function(messages) {
        res.status(200).send(messages);
    })
    .catch(function(error) {
        res.status(500).send(error.message);
    })
});

router.get('/systems', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN','DATA_ENTRY_ADMIN']}}),
function(req, res) {
    res.render('orgSettings/flow/systems', {
    })
});

module.exports = router;