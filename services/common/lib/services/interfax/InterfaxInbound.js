var InterfaxRequest = require('./InterfaxRequest');
var request = require('request-promise');
var _ = require('lodash');

function InterfaxInbound(config) {
  this.config = _.merge({}, InterfaxRequest.defaultConfig, config);  
}

InterfaxInbound.prototype.getRecord = function(transactionId) {        
    var options = {
        auth: {
            user: this.config.user,
            pass: this.config.pass,
            sendImmediately: true
        },
        method: 'GET',
        uri: InterfaxRequest.getBaseUrl() + '/inbound/faxes/'+transactionId,
        json: true
    };        
    return request(options);
}

InterfaxInbound.prototype.getImage = function(transactionId) {
    var options = {
        auth: {
            user: this.config.user,
            pass: this.config.pass,
            sendImmediately: true
        },
        method: 'GET',
        uri: InterfaxRequest.getBaseUrl() + '/inbound/faxes/'+transactionId+'/image',
        encoding: null
    }; 
    return request(options);
}

InterfaxInbound.prototype.getList = function(unreadOnly, limit, lastId, allUsers) {
    var qs = {};
    if(unreadOnly != null) qs.unreadOnly = unreadOnly;
    if(limit != null) qs.limit = limit;
    if(lastId != null) qs.lastId = lastId;
    if(allUsers != null) qs.allUsers = allUsers;

    var options = {
        auth: {
            user: this.config.user,
            pass: this.config.pass,
            sendImmediately: true
        },
        method: 'GET',
        uri: InterfaxRequest.getBaseUrl() + '/inbound/faxes',
        json: true,
        qs: qs
    }; 
    return request(options);
}

module.exports = InterfaxInbound;