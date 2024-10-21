var Promise = require('bluebird');
var Value = require('../../values/Value.js');



module.exports = function() {
    
    console.log('Running validator.propertySet task.');
    return Value.getValue(this, this.taskConfig.value)
    .then(function(value) {
        return new Promise(function(resolve, reject) {
            
            var isSet = value !== null && value !== "" && value !== undefined;
            console.log('Evaluating value isSet = '+isSet);
            if( isSet )
                resolve();
            else 
                reject(new Error('Property is not set, failing task.'));
        });
    });
};