var uuid = require('uuid');
var Sampler = require('../util/Sampler.js');
var winston = require('winston');
var _ = require('lodash');
var crypto = require('crypto');
var bigint = require('big-integer');

function TransactionLog(transactionName, logData, request) {
    this.transactionName = transactionName.toUpperCase();
    this.transactionId = uuid.v4();
    this.sampler = new Sampler();
    
    this.logData = logData || {};
    this.logData.transactionId = this.transactionId;
    this.logData.transactionName = this.transactionName;
    
    if( request && request.hasOwnProperty('params') && request.params.tid )
        this.logData.parentTransactionId = request.params.tid;
    
    this.logInfo('START', 'Starting transaction.');
}

TransactionLog.prototype.sample = function(sampleName) {
    this.sampler.sample(sampleName);
}

TransactionLog.prototype.appendShardData = function(record) {
    let streamShardId, streamHashKey, streamPartitionKey;
    
    try {
        streamShardId = record.eventID.split(':')[0];
        streamPartitionKey = record.kinesis.partitionKey;
        
        var hash = crypto.createHash('md5').update(streamPartitionKey).digest("hex");
        streamHashKey = bigint(hash, 16).toString();
    }
    catch(error) {
        // noop - we just try/catch this because we don't want it to interrupt the 
        // script as these variables are only for logging.
    }
    
    this.appendLogData({
        lambdaEventId: record.eventID,
        streamShardId: streamShardId,
        streamHashKey: streamHashKey,
        streamPartitionKey: streamPartitionKey
    });
}

TransactionLog.prototype.appendLogData = function(properties) {
    if(_.isPlainObject(properties))
        this.logData = _.merge({}, this.logData, properties);
}

TransactionLog.prototype.generateEventLogData = function(eventType, transientLogData) {
    // We allow for the specification of log data that is specific 
    // only to the specified event. We merge that into the transaction
    // log data.
    var eventLogData = _.clone(this.logData);
    if(transientLogData != null && _.isPlainObject(transientLogData))
        eventLogData = _.merge(eventLogData, transientLogData);
        
    eventLogData.eventType = this.transactionName + '_' + eventType;

    if(eventLogData.hasOwnProperty('facilityId')) {
        var facilityId = parseInt(eventLogData.facilityId);
        if(isNaN(facilityId)) facilityId = null;
        eventLogData.facilityId = facilityId;
    }

    if(_.isInteger(eventLogData.facilityId) && _.isString(eventLogData.orgInternalName)) {
        eventLogData.orgFac = eventLogData.orgInternalName + ':' + eventLogData.facilityId.toString();
    }
    
    return eventLogData;
}

TransactionLog.prototype.logInfo = function(eventType, message, eventLogData) {
    winston.log('info', message, this.generateEventLogData(eventType, eventLogData));
}

TransactionLog.prototype.logError = function(eventType, message, eventLogData) {
    var errorData = eventLogData;
    if(errorData && _.isError(errorData))
        errorData = {errorMessage:errorData.message, errorStack: errorData.stack};
    
    winston.log('error', message, this.generateEventLogData(eventType, errorData));
}

TransactionLog.prototype.logWarn = function(eventType, message, eventLogData) {
    winston.log('warn', message, this.generateEventLogData(eventType, eventLogData));
}

TransactionLog.prototype.finishTransaction = function() {
    this.logInfo('END', 'Finishing transaction.', {samples:this.sampler.samples});
}

module.exports = TransactionLog;