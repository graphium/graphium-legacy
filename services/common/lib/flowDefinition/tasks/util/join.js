var Promise = require('bluebird');

module.exports = {
    isValidConfig: function() {
        return true;  
    },
    
    run: function() {
        var a = this.input != null ? this.input.toString() : "";
        var b = this.taskConfig.value != null ? this.taskConfig.value.toString() : "";
        console.log('Joining "' + a + '" + "' + b + '"');
        return Promise.resolve(a+b);
    } 
};