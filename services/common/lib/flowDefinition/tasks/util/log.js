var Promise = require('bluebird');

module.exports = {
    requiredConfigProperties: ["logLevel", "logMessage"],
    
    run: function(taskConfig) {    
       return Promise.resolve(console.log('['+taskConfig.logLevel+'] ' + taskConfig.logMessage )); 
    }
}