/* global process */

var samples = {};
var lastSampleTime = Date.now();

function sample(name) {
    samples[name] = Date.now() - lastSampleTime;
    lastSampleTime = Date.now();
}

// This is the worker file that wraps the code being passed in
// and executes it in a vm module in the current context. It is expected
// that this will be executed by a child_process.fork call and run with
// reduced user/group privileges.

var _ = require('lodash');
var graphium = require('@graphiumhealth/graphium-sdk');
var vm = require('vm');
var xmljs = require('xml-js');
var xmldom = require('xmldom');
var pako = require('pako');
var FTPClient = require('ftp');
var sftp = require('../ftp/sftp.js');
var gicUtils = require('./utils/gicUtils.js');
var FlowCoreServicesPrivate = require('../services/FlowCoreServicesPrivate.js');
var EmrFormGeneration = require('../services/EmrFormGeneration.js');
var Sampler = require('../util/Sampler.js');
var Promise = require('bluebird');
var EncounterFormPqrsEval = require('../importer/EncounterFormPqrsEval.js');
var EncounterFormMacraEval2019 = require('../importer/macra2019/EncounterFormMacraEval2019').default;
var EncounterFormMacraEval2020 = require('../importer/macra2020/EncounterFormMacraEval2020').default;
var EncounterFormMacraEval2021 = require('../importer/macra2021/EncounterFormMacraEval2021').default;
var EncounterFormMacraEval2022 = require('../importer/macra2022/EncounterFormMacraEval2022').default;
var EncounterFormMacraEval2023 = require('../importer/macra2023/EncounterFormMacraEval2023').default;
var EncounterFormMacraEval2024 = require('../importer/macra2024/EncounterFormMacraEval2024').default;
var GraphiumServiceUtils = require('../importer/GraphiumServiceUtils.js').default;
var RecordImporter = require('../importer/RecordImporter.js');
var ImportBatchService = require('../dao/ImportBatchService');
var AdsService = require('../dao/AdsService');
var EncounterFormService = require('../dao/EncounterFormService');
var ImportAnalyticsDAO = require('../dao/ImportAnalyticsDAO');
var EnvironmentConfig = require('../config/EnvironmentConfig').EnvironmentConfig;
var moment = require('moment'); require('moment-range'); require('moment-timezone');
var faker = require('faker');
var jsonpointer = require('json-pointer');
var semver = require('semver');
var jsonpath = require('jsonpath');
var fs = require ('fs');

sample('requires');

process.on('uncaughtException', function(error) {
    callFail(error);
});

process.on('message', function(message) {
   switch(message.type) {
       case 'RUN':
            try {
                sample('receivedRun');
                if(message.configParametersCompressed) {
                    var configParameters = JSON.parse(pako.inflate(message.configParametersCompressed,{to:'string'}));
                    EnvironmentConfig.loadConfigData(configParameters);
                }
                var messageInstanceDecompressed = JSON.parse(pako.inflate(message.messageInstanceCompressed,{to:'string'}));
                executeScript(message.flow, messageInstanceDecompressed, configParameters);
            }
            catch(error) {
                callFail(error);
            }
            break;
       default: //console.error('(FlowScript.worker) Received unrecognized message from FlowScript.'); break;
   }
});

function callSucceed(result) {
    sample('completedScriptSuccess');

    process.send({
        type: 'RUN_SUCCESS',
        result: result
    }, function(err) {
        process.exit();
    });
}

function callFail(error) {
    sample('completedScriptFailed');

    var errorMessage;
    var errorStack;
    var errorResult;
    if(_.isError(error)) {
        errorMessage = error.message;
        errorStack = error.stack;
        errorResult = error.result;
    }
    else if(_.isString(error)) {
        errorMessage = error;
    }

    process.send({
       type: 'RUN_FAILURE',
       error: {
           message: errorMessage,
           stack: errorStack,
           result: errorResult
       }
    },function(err) {
        process.exit();
    });
}

function spawnChildMessageRequest(flow, messageInstance, messageRequest, returnRequest) {
    messageRequest.orgInternalName = flow.orgInternalName;
    messageRequest.facilityId = flow.facilityId;
    messageRequest.parentMessageRequestGuid = messageInstance.messageRequestGuid;
    messageRequest.syncStreamHashKey = messageInstance.messageRequest.syncStreamHashKey;

    return FlowCoreServicesPrivate.intakeMessageRequest(
        messageRequest.orgInternalName,
        messageRequest.facilityId,
        messageRequest,
        returnRequest);
}

function spawnAsyncHandler(flow, parentMessageInstance, handler, messageContent, returnRequest) {

    if(!flow.runtimeVersion || !semver.gte(flow.runtimeVersion, "1.1.0")) {
        return Promise.reject(new Error('This flow runtime version does not support spawning new scripts using handlers.'));
    }

    var messageRequest = {
        orgInternalName: parentMessageInstance.orgInternalName,
        facilityId: parentMessageInstance.facilityId,
        parentMessageRequestGuid: parentMessageInstance.messageRequestGuid,
        childMessageRequestHandler: handler,
        parentMessageInstanceGuid: parentMessageInstance.messageInstanceGuid,
        parentFlowGuid: flow.flowGuid,
        syncStreamHashKey: parentMessageInstance.messageRequest.syncStreamHashKey,
        streamType: parentMessageInstance.streamType,
        messageType: parentMessageInstance.messageRequest.messageType + ".child",
        messageContent: messageContent,
        messageContentType: 'json'
    };

    return FlowCoreServicesPrivate.intakeMessageRequest(
        messageRequest.orgInternalName,
        messageRequest.facilityId,
        messageRequest,
        returnRequest);
}

function generateForm(messageInstance, formId, excludedPages) {
    return EmrFormGeneration.getForm(messageInstance.orgInternalName, formId, excludedPages);
}

function sendGicOutboundMessage(orgInternalName, systemName, outboundMessageRequest) {
    return FlowCoreServicesPrivate.sendOutboundGicRequest(orgInternalName, systemName, outboundMessageRequest, true);
}

function executeScript(flow, messageInstance) {
    //console.log('(FlowScript.worker) executeScript');

    var scriptTimeout = _.isInteger(flow.timeout) ?
                            Math.min(flow.timeout, 1200 ) : 5;
    var scriptContent = flow.flowContent;

    var sandbox = {
        jsonpath: jsonpath,
        Promise: Promise,
        Sampler: Sampler,
        Buffer: Buffer,
        console: console,
        moment: moment,
        faker: faker,
        setTimeout: setTimeout,
        graphium: graphium,
        jsonpointer: jsonpointer,
        FTPClient: FTPClient,
        xmljs: xmljs,
        xmldom: xmldom,
        utils: {
            gic: gicUtils
        },
        importer: {
            EncounterFormPqrsEval: EncounterFormPqrsEval,
            GraphiumServiceUtils: GraphiumServiceUtils,
            RecordImporter: RecordImporter,
            EncounterFormMacraEval2019: EncounterFormMacraEval2019,
            EncounterFormMacraEval2020: EncounterFormMacraEval2020,
            EncounterFormMacraEval2021: EncounterFormMacraEval2021,
            EncounterFormMacraEval2022: EncounterFormMacraEval2022,
            EncounterFormMacraEval2023: EncounterFormMacraEval2023,
            EncounterFormMacraEval2024: EncounterFormMacraEval2024
        },
        sftp: sftp,
        "_": _,
        fs: process.env.NODE_ENV == 'development' ? fs : null,
        env: process.env,
        require: require,
        context: {
            messageInstance: messageInstance,
            flow: _.cloneDeep(flow),
            succeed: callSucceed,
            fail: callFail,
            spawnAsyncHandler: function(handler, messageContent, returnRequest) {
                return spawnAsyncHandler(flow, messageInstance, handler, messageContent);
            },
            spawnChildMessageRequest: function(messageRequest, returnRequest) {
                return spawnChildMessageRequest(flow, messageInstance, messageRequest, returnRequest);
            },
            generateForm: function(formId, excludedPages) {
                return generateForm(messageInstance, formId, excludedPages);
            },
            sendGicOutboundMessage: function(systemName, outboundMessageRequest) {
                return sendGicOutboundMessage(flow.orgInternalName, systemName, outboundMessageRequest);
            },
            getUpdatedImportBatchRecords: function(startDate, endDate, timezone) {
                return ImportBatchService.getUpdatedImportBatchRecords(flow.orgInternalName, startDate, endDate, timezone);
            },
            getUpdatedEncounterForms: function(facilityId, startDate, endDate) {
                return EncounterFormService.getUpdatedEncounterForms({ from: startDate, to: endDate, facilityId: facilityId, orgInternalName: flow.orgInternalName });
            },
            getCompleteEncounterFormsWithoutTags: function(facilityId, excludedTags, startDate, excludedFormDefinitionNames ) {
                return EncounterFormService.getCompleteEncounterFormsWithoutTags({
                    orgInternalName: flow.orgInternalName,
                    facilityId: facilityId,
                    excludedTags: excludedTags,
                    excludedFormDefinitionNames: excludedFormDefinitionNames,
                    startDate: startDate
                 });
            },
            getPrevious30DaysAbeoCaseLog: function(facilityIds) {
                return EncounterFormService.getPrevious30DaysAbeoCaseLog({
                    orgInternalName: flow.orgInternalName,
                    facilityIds: facilityIds
                });
            },
            getUpdatedEncounterFormSubstanceList: function(facilityId, startDate, endDate) {
                return EncounterFormService.getUpdatedEncounterFormSubstanceList({
                    orgInternalName: flow.orgInternalName,
                    facilityId: facilityId,
                    from: startDate,
                    to: endDate
                });
            },
            getUpdatedEncounterFormsGHStandardBilling: function(facilityId, startDate, endDate, demographicsOnly, useFacilityTimezone, formSelectionMode, sendOnceTagCategory, sendOnceTagName, completeFormsOnly, minimumDateBoundary, preventFutureDateOfService, allowFormsToAgeDays, sendOnceIncludeUpdatedForms) {
                return EncounterFormService.getUpdatedEncounterFormsGHStandardBilling({
                    orgInternalName: flow.orgInternalName,
                    facilityId: facilityId,
                    from: startDate,
                    to: endDate,
                    demographicsOnly: demographicsOnly,
                    useFacilityTimezone: useFacilityTimezone,
                    formSelectionMode: formSelectionMode,
                    sendOnceTagCategory: sendOnceTagCategory,
                    sendOnceTagName: sendOnceTagName,
                    completeFormsOnly: completeFormsOnly,
                    minimumDateBoundary: minimumDateBoundary,
                    preventFutureDateOfService: preventFutureDateOfService,
                    allowFormsToAgeDays: allowFormsToAgeDays,
                    sendOnceIncludeUpdatedForms: sendOnceIncludeUpdatedForms
                });
            },
            findMatchingEncounterForms: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.findMatchingEncounterForms(params);
            },
            cptImport2019EncounterFormMatch01: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImport2019EncounterFormMatch01(params);
            },
            cptImport2019EncounterFormMatch02: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImport2019EncounterFormMatch02(params);
            },
            cptImport2019EncounterFormMatch03: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImport2019EncounterFormMatch03(params);
            },
            cptImport2019EncounterFormMatch04: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImport2019EncounterFormMatch04(params);
            },
            cptImport2019EncounterFormMatch05: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImport2019EncounterFormMatch05(params);
            },
            cptImport2019EncounterFormMatch06: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImport2019EncounterFormMatch06(params);
            },
            cptImport2019EncounterFormMatch07: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImport2019EncounterFormMatch07(params);
            },
            cptImport2019EncounterFormMatch08: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImport2019EncounterFormMatch08(params);
            },
            cptImportEncounterFormMatch01: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImportEncounterFormMatch01(params);
            },
            cptImportEncounterFormMatch02: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImportEncounterFormMatch02(params);
            },
            cptImportEncounterFormMatch03: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImportEncounterFormMatch03(params);
            },
            cptImportEncounterFormMatch04: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImportEncounterFormMatch04(params);
            },
            cptImportEncounterFormMatch05: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImportEncounterFormMatch05(params);
            },
            cptImportEncounterFormMatch06: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImportEncounterFormMatch06(params);
            },
            cptImportEncounterFormMatch07: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImportEncounterFormMatch07(params);
            },
            cptImportEncounterFormMatch08: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.cptImportEncounterFormMatch08(params);
            },
            updateEncounterForm: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.updateEncounterForm(params);
            },
            getImportBatchRecordsByFacilityAndMonth: function() {
                return ImportAnalyticsDAO.getImportBatchRecordsByFacilityAndMonth(flow.orgInternalName);
            },
            getEncounterFormsWithDiagnoses: function (params) {
                params.orgInternalName = flow.orgInternalName;
                return EncounterFormService.getEncounterFormsWithDiagnoses(params);
            },
            createAdsTransaction: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return AdsService.createAdsTransaction(params);
            },
            createAds: function(params) {
                params.orgInternalName = flow.orgInternalName;
                return AdsService.createAds(params);
            }
        }
    };

    try {
        if(flow.runtimeVersion && semver.gte(flow.runtimeVersion, "1.1.0")) {
            console.log('Runtime version >= 1.1.0');
            var handler = flow.defaultHandler;
            if(!handler) {
                handler = "index";
            }

            console.log('Default handler: ' + handler);
            if(messageInstance.messageRequest && messageInstance.messageRequest.childMessageRequestHandler) {
                console.log('Has parent message request, looking for child handler.');
                handler = messageInstance.messageRequest.childMessageRequestHandler;
            }

            /*
            scriptContent =
                `var requireFromString = require('require-from-string');\n` +
                `var scriptModule = requireFromString(${JSON.stringify(scriptContent)});\n` +
                `scriptModule.${handler}(context, context.messageInstance.messageRequest.messageContent);`;
                */
            scriptContent = scriptContent + '\n\n' +
                'var content = context.messageInstance.messageRequest ? context.messageInstance.messageRequest.messageContent : context.messageInstance;\n' +
                'try {\n' +
                    handler + '(context, content);\n' +
                '} catch(error) { console.log("UNHANDLED REJECTION: "+error.message); context.fail(error); }';

        }
        else {
            console.log('Runtime version < 1.1.0');
        }
        /*
        var defaultHandlerEmpty = _.isString(flow.defaultHandler) ? !!_.trim(flow.defaultHandler) : _.isEmpty(flow.defaultHandler);
        console.log("flow.defaultHandler: " + flow.defaultHandler);
        console.log("_.isString(flow.defaultHandler): " + _.isString(flow.defaultHandler));
        console.log("!!_.trim(flow.defaultHandler): " + !!_.trim(flow.defaultHandler));
        console.log("_.isEmpty(flow.defaultHandler: " + _.isEmpty(flow.defaultHandler));
        console.log('defaultHandlerEmpty: ' + defaultHandlerEmpty);
        */

        //console.log('Context: ');
        //console.log(JSON.stringify(context, null, 4));
        //console.log('Running script: ' + scriptContent);

        var context = new vm.createContext(sandbox);
        var script = new vm.Script(scriptContent);
        script.runInContext(context, {timeout:scriptTimeout*1000});
    }
    catch(error) {
        // This will catch any syntax error that may occur when trying to run the script.
        console.log(error.message);
        console.log(error.stack);
        process.nextTick(function() { callFail(error) });
    }
}