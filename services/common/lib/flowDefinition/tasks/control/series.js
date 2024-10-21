var Promise = require('bluebird');
var Task = require('../../Task.js');

module.exports = {
    
    isValidConfig : function() { 
        return true;
    },
    
    run: function() {
        var _this = this;
        
        if(!this.taskConfig.tasks)
            return Promise.reject(new Error('control.series does not define any tasks.'));
        
        return this.taskConfig.tasks.reduce(function(promise, seriesTaskConfig) {
            return promise.then(function(inputValue) { 
                return Task.run(_this.flow, seriesTaskConfig, inputValue); 
            });
        }, Promise.resolve(this.input));
    }
}