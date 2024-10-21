"use strict";

if( typeof _ === 'undefined' ) {
    if( typeof require !== 'undefined' ) {
        var _ = require('lodash')
    }
    else {
        throw new Error('templateHelpers requires lodash');
    } 
}


var mod = (function() {

    function isValidImportBatchRecordAction(importBatchRecord, action) {
        switch(action) {
            case 'discard' : 
                return importBatchRecord.recordStatus == 'pending_data_entry';
            case 'undiscard' :
                return importBatchRecord.recordStatus == 'discarded';
            case 'complete_data_entry':
                return importBatchRecord.recordStatus == 'pending_data_entry';
            case 'save_data_entry':
                return importBatchRecord.recordStatus == 'pending_data_entry';
            case 'save_and_reprocess':
                return _.includes(['pending_review','processing_complete'], importBatchRecord.recordStatus);
            case 'add_to_processing_queue':
                return _.includes(['pending_processing','processing'], importBatchRecord.recordStatus) && importBatchRecord.lastUpdatedAt < (new Date().getTime() - (60000*10));
            case 'ignore':
                return _.includes(['pending_review','processing_complete'], importBatchRecord.recordStatus);
            case 'unignore':
                return importBatchRecord.recordStatus == 'ignored';
            default:
                return false;
        }
    }

    function isImportBatchRecordEditable(importBatchRecord) {
        return _.includes(['pending_data_entry','pending_review','processing_complete'], importBatchRecord.recordStatus);
    }

    function getAllDataEntryErrors() {
        return _.concat(getProviderDataEntryErrors(), getDataEntryErrors(), getSurgeryLocationDataEntryErrors());
    }

    function getErrorByLabelOrData(labelOrData) {
        var allErrors = getAllDataEntryErrors();
        var matchingError = _.find(allErrors, function(e) { return e.data == labelOrData || e.label == labelOrData; });
        return matchingError;
    }

    function getProviderDataEntryErrors() {
        return [
            {data:'#providerNotFound', label:'Provider Not Found', description: 'The provider on the form is not found in this facilities\' provider list.'}
        ];
    }

    function getSurgeryLocationDataEntryErrors() {
        return [
            {data:'#locationNotFound', label:'Location Not Found', description: 'The location listed the form is not found in this facilities\' location list.'}
        ];
    }

    function getDataEntryErrors() {
        return [
            {data:'#dataNotEntered', label:'Data Not Entered', description:'The field on the form is blank or empty.'},
            {data:'#fieldIllegible', label:'Form Field Illegible', description:'Cannot read the handwriting on the form, or this field is otherwise illegible.'}
        ];
    }

    function getAllPermissions(orgUser) {
        // We join together category and name using a ':'.
        return _.uniq(_.flatMap(orgUser.roles, function(role) { 
            return _.map(role.permissions, function(permission) { return [permission.categoryName,permission.permissionName].join(':'); });  
        }));
    }

    function hasPermission(orgUser, permission) {
        var hasPermission = _.includes(getAllPermissions(orgUser), permission);
        return hasPermission;
    }

    function hasEveryPermission(orgUser, permissions) {
        return _.every(permissions, function(permission,index,collection) { return hasPermission(orgUser, permission); });
    }

    function hasSomePermission(orgUser, permissions) {
        return _.some(permissions, function(permission,index,collection) { return hasPermission(orgUser, permission); });
    }

    function hasRole(orgUser, role) {
        var allRoles = _.map(orgUser.roles, 'roleName');
        return _.includes(allRoles, role);
    }

    function hasEveryRole(orgUser, roles) {
        return _.every(roles, function(role) { return hasRole(orgUser, role); });
    }

    function hasSomeRole(orgUser, roles) {
        return _.some(roles, function(role) { return hasRole(orgUser, role); });
    }

    // ---

    function validateUserAccessObject(orgUser, access) {
        // Must define either permissions or roles or we are invalid.
        if(!access.hasOwnProperty('permissions') && !access.hasOwnProperty('roles'))
            return false;

        // By default, if 'permissions' is defined, we are invalid until we process the
        // permissions.
        var validPermission = !access.hasOwnProperty('permissions');
        if(access.permissions && _.isArray(access.permissions) && access.permissions.length > 0) {
            validPermission = hasEveryPermission(orgUser, access.permissions);
        }
        if(access.permissions && access.permissions.every && _.isArray(access.permissions.every) && access.permissions.length > 0) {
            validPermission = hasEveryPermission(orgUser, access.permissions.every);
        }
        if( validPermission && access.permissions && access.permissions.some && _.isArray(access.permissions.some) && access.permissions.some.length > 0) {
            validPermission = hasSomePermission(orgUser, access.permissions.some);
        }

        // By default, if 'roles' is defined, we are invalid until we process the
        // roles.
        var validRole = true;
        if(access.hasOwnProperty('roles')) {
            var hasEveryRoleResult = true;
            var hasSomeRolesResult = true;
            if((_.isArray(access.roles) && access.roles.length > 0) ||
            (_.isArray(access.roles.every) && access.roles.every.length > 0)) {
                hasEveryRoleResult = hasEveryRole(orgUser, _.isArray(access.roles) ? access.roles : access.roles.every);
            }
            if(_.isArray(access.roles.some) && access.roles.some.length > 0) {
                hasSomeRolesResult = hasSomeRole(orgUser, access.roles.some);
            }
            validRole = hasEveryRoleResult && hasSomeRolesResult;
        }

        return validPermission && validRole;
    }

    function currentUserHasPermission(user, permission) {

        var allPermissions = _.uniq(_.flatMap(user.roles, function(role) { 
            return _.map(role.permissions, function(permission) { return [permission.categoryName,permission.permissionName].join(':'); });  
        }));

        return _.includes(allPermissions, permission);
    }

    function currentUserHasRole(user, role) {
        var allRoles = _.map(user.roles, 'roleName');
        return _.includes(allRoles, role);
    }


    function getFlowType(flowType) {
        switch(flowType) {
            case 'script': return 'Inline';
            case 'system': return 'Template';
            default: return '<i>Unknown</i>';
        }
    }

    function getFlowTypes() {
        return [
            {data:'script', label:'Inline', description:'Source code for the flow script is stored as part of this flow.'},
            {data:'system', label:'System Template', description:'Uses one of the Graphium Health common flow templates. Source cannot be modified.'}
        ]
    }

    function getStreamType(streamType) {
        switch(streamType) {
            case 'gic': return 'EMR';
            case 'scheduled': return 'Scheduled';
            default: return 'Custom ('+streamType+')';
        }
    }

    function getGicMessageTypeLabel(messageType) {
        var messageTypeData = _.find(getGicMessageTypes(),{messageType:messageType});
        if(messageTypeData)
            return messageTypeData.name + ' (' + messageTypeData.hl7 + ')';
        else
            return messageTypeData + ' (Unknown)';
    }

    function getScheduledMessageTypeLabel(scheduledMessageType) {
        var messageTypeData = _.find(getScheduledMessageTypes(),{messageType:messageType});
        if(messageTypeData)
            return messageTypeData.name;
        else
            return messageTypeData + ' (Unknown)';
    }

    function getMessageRequestTypeDisplay(messageRequest) {
        switch(messageRequest.streamType) {
            case 'gic': 
                return _.find(getGicMessageTypes(),{messageType:messageRequest.messageType}).name;
            case 'scheduled': 
                var type = _.find(getScheduledMessageTypes(),{messageType:messageRequest.messageType});
                return type ? type.name : messageRequest.messageType;
            default: return messageRequest.messageType;
        }
    }

    function getMessageTypeDisplay(flow) {
        if(_.isArray(flow.messageTypes)) {
            switch(flow.streamType) {
                case 'gic': return _.map(flow.messageTypes, getGicMessageTypeLabel ).join(', ');
                case 'scheduled': return _.map(flow.messageType, getScheduledMessageTypeLabel ).join(', ');
                default: return flow.messageTypes.join(', ');
            }
        }
        return 'Unknown';
    }

    function getScheduledMessageTypes() {
        return [
            {messageType:'nightly', name:'Nightly'},
            {messageType:'hourly', name:'Hourly'},
            {messageType:'weekly', name:'Weekly'},
            {messageType:'every5min', name:'Every 5 Minutes'},
            {messageType:'every15min', name:'Every 15 Minutes'},
            {messageType:'daily0200', name:'Daily at 02:00 GMT'},
            {messageType:'daily1000', name:'Daily at 10:00 GMT'}
        ]
    }

    function getGicMessageTypes() {
        return [
            {messageType:'1', name:'New Appointment', hl7:'SIU-S12'},
            {messageType:'2', name:'Rescheduled Appointment', hl7:'SIU-S13'},
            {messageType:'3', name:'Updated Appointment', hl7:'SIU-S14'},
            {messageType:'4', name:'Cancelled Appointment', hl7:'SIU-S15'},
            {messageType:'5', name:'New Patient', hl7:'ADT-A04'},
            {messageType:'6', name:'Updated Patient', hl7:'ADT-A08'},
            {messageType:'7', name:'Blocked Schedule', hl7:'SIU-S23'},
            {messageType:'8', name:'Unblocked Schedule', hl7:'SIU-S24'},
            {messageType:'9', name:'New Document', hl7:'MDM-T02'},
            {messageType:'10', name:'Updated Document', hl7:'MDM-T08'},
            {messageType:'11', name:'Document Status Changed', hl7:'MDM-T04'},
            {messageType:'12', name:'Observation Result', hl7:'ORU-R01'},
            {messageType:'13', name:'Discharged Patient', hl7:'ADT-A03'},
            {messageType:'14', name:'Admitted Patient', hl7:'ADT-A01'},
            {messageType:'15', name:'Transferred Patient', hl7:'ADT-A02'},
            {messageType:'16', name:'Pre-admitted Patient', hl7:'ADT-A05'},
            {messageType:'17', name:'Cancel Pre-admitted Patient', hl7:'ADT-A11'},
            {messageType:'18', name:'Cancel Transferred Patient', hl7:'ADT-A12'},
            {messageType:'19', name:'Cancel Discharged Patient', hl7:'ADT-A13'},
            {messageType:'20', name:'Order Message', hl7:'ORM-O01'},
            {messageType:'21', name:'Add Person', hl7:'ADT-A28'},
            {messageType:'22', name:'Delete Person', hl7:'ADT-A29'},
            {messageType:'23', name:'Update Person', hl7:'ADT-A31'},
            {messageType:'24', name:'Post Financial Transaction', hl7:'DFT-P03'},
            {messageType:'25', name:'Delete Appointment', hl7:'SIU-S17'},
            {messageType:'26', name:'Patient Missed Appointment', hl7:'SIU-S26'}
        ];
    }

    function getBatchDataTypeLabel(batch) {
        var typeString;
        var countString;
        var warningString;

        switch(batch.batchDataType) {
            case 'pdf': 
                typeString = 'PDF'; 
                break;
            case 'dsv': 
                typeString = 'DSV';
                if(batch.batchDataTypeOptions) {
                    if(batch.batchDataTypeOptions.delimiter == 'tab')
                        typeString += ' (Tab Delimited)';
                    else if(batch.batchDataTypeOptions.delimiter == 'comma')
                        typeString += ' (Comma Delimited)';
                    else if(batch.batchDataTypeOptions.delimiter == 'pipe')
                        typeString += ' (Pipe Delimited)';
                    else if(batch.batchDataTypeOptions.delimiter == 'colon')
                        typeString += ' (Colon Delimited)';
                } 
                break;
            default:
                typeString = batch.batchDataType;
                break;
        }

        if(batch.batchDataType == 'pdf' && batch.batchDataPdfPageCount != null) {
            countString = '(' + batch.batchDataPdfPageCount + ')';
        }
        
        return [typeString,countString].join(' ');
    }

    function getFlowConfigDisplayNameAndValue(systemFlow, configPropertyName, value) {
        if(systemFlow && systemFlow.parameters) {
            var parameter = _.find(systemFlow.parameters, {name: configPropertyName});
            var ret = {};
            if(parameter) {
                ret.name = parameter.title;
                if(value && parameter.isPassword) {
                    ret.value = _.pad('', value.length, '*');
                }
                else {
                    ret.value = value;
                }
                return ret;
            }
        }
        return {
            name: configPropertyName,
            value: value
        };
    }

    return {
        currentUserHasRole: currentUserHasRole,
        currentUserHasPermission: currentUserHasPermission,
        
        userHasAccess: function(user, access) {
            return validateUserAccessObject(user, access);
        },


        getFacilityName: function(facilities, facilityId) {
            var facility = _.find(facilities, {facilityId: facilityId});
            return facility ? facility.facilityName : null;
        },

        getFriendlyImportEventDescription: function(event) {
            switch(event.eventType) {
                case 'record_status_update': return 'Record status changed from ' + event.eventData.statusFrom + ' to ' + event.eventData.statusTo + ' by ' + event.userName;
                case 'record_data_entered': return 'Data was updated by ' + event.userName;
                case 'record_opened': return 'Record was opened by ' + event.userName;
                case 'record_discarded': return 'Record was discarded by ' + event.userName;
                case 'record_note_added': return 'A note was added by ' + event.userName;
                default: return event.eventType;
            }
        },

        getFilteredProviderList: function(providers, providerType) {
            if(!providers || !providerType)
                return [];
            
            if(providerType == '*')
                return providers;
            
            var providerTypes = providerType;
            if(_.isString(providerType))
                providerTypes = [providerType];

            var filteredList =  _.filter(providers, function(provider) {
                //console.log('_.includes ' + JSON.stringify(providerTypes) + ' ' + provider.providerType);
                return _.includes(providerTypes, provider.providerType);
            })
            
            return _.sortBy(filteredList, ['lastName','firstName','speciality']);
        },

        getDataEntryProgressPercentages: function(importBatchStatusCounts) {

            var totalRecords = 0;
            var counts = {
                total: 0,
                pending_data_entry: { total:0, percentage:0 }, 
                pending_processing: { total:0, percentage:0 },
                pending_review: { total:0, percentage:0 }, 
                processing: { total:0, percentage:0 },
                processing_failed: { total:0, percentage:0 },
                processing_complete: { total:0, percentage:0 },
                discarded: { total:0, percentage:0 },
                ignored: {total: 0, percentage:0 }
            };
            
            _.forIn(importBatchStatusCounts, function(value, key) {
                counts.total += value;
                counts[key].total += value;
            });

            _.forOwn(counts, function(value, key) {
                if(key != 'total')
                    counts[key].percentage = value.total/counts.total;
            });

            return counts;

        },

        getFriendlyRecordStatus: function(recordStatus) {
            switch (recordStatus) {
                case 'pending_data_entry':
                    return 'Pending Data Entry';
                case 'pending_review':
                    return 'Pending Review';
                case 'pending_processing':
                    return 'Preparing to Process';
                case 'processing':
                    return 'Processing Record';
                case 'processing_failed':
                    return 'INVALID (Processing Failed)';
                case 'ignored':
                    return 'Ignored';
                case 'record_processing_succeeded':
                    return 'Record Processed Successfully';
                case 'record_processing_failed':
                    return 'Record Processing Failed';
                case 'processing_complete':
                    return 'Processing Complete';
                case 'discarded':
                    return 'Discarded';
                default:
                    return 'Unknown Status';
            }
        },

        getFriendlyBatchStatus: function(batchStatus) {
            switch (batchStatus) {
                case 'pending_generation':
                    return 'Pending Generation';
                case 'generating':
                    return 'Generating Batch';
                case 'generation_error':
                    return 'Generation Error';
                case 'processing':
                    return 'Processing';
                case 'pending_review':
                    return 'Pending Review';
                case 'discarded':
                    return 'Discarded';
                case 'complete':
                    return 'Complete';
                default:
                    return 'Unknown Status';
            }
        },

        getRecordStatusIcon: function(recordStatus) {
            switch (recordStatus) {
                case 'pending_data_entry':
                    return 'edit';
                case 'pending_processing':
                    return 'hourglass';
                case 'processing':
                    return 'cog';
                case 'processing_failed':
                    return 'warning';
                case 'processing_complete':
                    return 'check';
                case 'discarded':
                    return 'trash';
                case 'ignored':
                    return 'trash';
                default:
                    return 'warning';
            }
        },

        getRecordStatusIconColor: function(recordStatus) {
            switch (recordStatus) {
                case 'pending_data_entry':
                    return '#FFA534';
                case 'pending_processing':
                    return '#23CCEF';
                case 'processing':
                    return '#23CCEF';
                case 'processing_failed':
                    return '#fa1825';
                case 'processing_complete':
                    return '#87CB16';
                case 'discarded':
                    return '#fa1825';
                default:
                    return '#fa1825';
            }
        },

        getBatchStatusMetadata: function(batchStatus) {
            switch(batchStatus) {
                case 'processing': return {
                    label: 'Processing',
                    description: 'This batch is currently in the process of having its data entered or there are records pending processing by the system after data entry is complete.'
                };
                default: return {
                    label: batchStatus,
                    description: ''
                }
            }
        },

        getFlowType: getFlowType,
        getStreamType: getStreamType,
        getGicMessageTypeLabel: getGicMessageTypeLabel,
        getScheduledMessageTypeLabel: getScheduledMessageTypeLabel,
        getGicMessageTypes: getGicMessageTypes,
        getScheduledMessageTypes: getScheduledMessageTypes,
        getMessageTypeDisplay: getMessageTypeDisplay,
        getMessageRequestTypeDisplay: getMessageRequestTypeDisplay,
        getAllDataEntryErrors: getAllDataEntryErrors,
        getErrorByLabelOrData: getErrorByLabelOrData,
        getProviderDataEntryErrors: getProviderDataEntryErrors,
        getSurgeryLocationDataEntryErrors: getSurgeryLocationDataEntryErrors,
        getDataEntryErrors: getDataEntryErrors,
        getFlowTypes: getFlowTypes,
        getFlowConfigDisplayNameAndValue: getFlowConfigDisplayNameAndValue,
        getBatchDataTypeLabel: getBatchDataTypeLabel,
        isValidImportBatchRecordAction: isValidImportBatchRecordAction,
        isImportBatchRecordEditable: isImportBatchRecordEditable
    }
})();

if( typeof exports !== 'undefined' ) {
    if( typeof module !== 'undefined' && module.exports ) {
        exports = module.exports = mod;
    }
    exports.helpers = mod;
} 
else {
    this.helpers = mod;
}