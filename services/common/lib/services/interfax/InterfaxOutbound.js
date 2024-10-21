var InterfaxRequest = require('./InterfaxRequest');
var request = require('request-promise');
var _ = require('lodash');

function InterfaxOutbound(config) {
  this.config = _.merge({}, InterfaxRequest.defaultConfig, config);  
}

InterfaxOutbound.prototype.getOutboundCredits = function() {        
    var options = {
        auth: {
            user: this.config.user,
            pass: this.config.pass,
            sendImmediately: true
        },
        method: 'GET',
        uri: InterfaxRequest.getBaseUrl() + '/accounts/self/ppcards/balance',
        json: true
    };        
    return request(options);
}

module.exports = InterfaxOutbound;