var Formatter = require('../formatters/Formatter.js');
var pointer = require('json-pointer');
var _ = require('lodash');

function PointerValue(task, valueConfig)
{
    this.task = task;
    this.valueConfig = valueConfig;
}

PointerValue.prototype.isConfigValid = function() {
    return this.valueConfig.hasOwnProperty("valueType") &&
           this.valueConfig.valueType == "pointer" &&
           this.valueConfig.hasOwnProperty("pointer") &&
           this.valueConfig.pointer !== null;
}

PointerValue.prototype.getUnformattedValue = function() {
    var pointerContext = {
        taskInput: this.task.input,
        messageContent: this.task.flow.message,
        variables: this.task.flow.data  
    };
    try {
        return pointer.get(pointerContext, this.valueConfig.pointer);
    }
    catch(error) {
        return null;
    }
}

PointerValue.prototype.getValue = function() {
    var _this = this;
    if( !this.isConfigValid() ) 
        return Promise.reject(new Error('Pointer value config is not valid.'));
        
    return Promise.resolve(this.getUnformattedValue()).then(function(unformattedValue) {
        return Formatter.formatValue(_this.valueConfig, unformattedValue);
    });
}

module.exports = PointerValue;