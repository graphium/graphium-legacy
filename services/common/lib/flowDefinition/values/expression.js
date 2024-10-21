var Formatter = require('../formatters/Formatter.js');
var Promise = require('bluebird');
var vm = require('vm');

function ExpressionValue(task, valueConfig)
{
    this.task = task;
    this.valueConfig = valueConfig;
}

ExpressionValue.prototype.isConfigValid = function( valueConfig ) {
    return this.valueConfig.hasOwnProperty("valueType") &&
           this.valueConfig.valueType == "expression" &&
           this.valueConfig.hasOwnProperty("expression") &&
           this.valueConfig.expression !== "" && this.valueConfig.expression !== null;
}

ExpressionValue.prototype.getUnformattedValue = function() {
    var context = JSON.parse(JSON.stringify({
            flowData: this.task.flow.data,
            taskInput: this.task.input,
            flowMessageContent: this.task.flow.message
    }));
    
    try {
        console.log('Value expression: ' + this.valueConfig.expression);
        var expression = this.valueConfig.expression;
        var v = vm.runInNewContext(expression, context);
        console.log('Expression value: ' + v);
        return v;
    }
    catch( error ) {
        console.log("Warning: Unable to execute value expression: " + JSON.stringify({expression:expression,context:context,error:error}));
        return null;
    }
}

ExpressionValue.prototype.getValue = function() {
    var _this = this;
    if( !this.isConfigValid() ) 
        return Promise.reject(new Error('Expression value config is not valid.'));
        
    return Promise.resolve(this.getUnformattedValue()).then(function(unformattedValue) {
        return Formatter.formatValue(_this.valueConfig, unformattedValue);
    });
}

module.exports = ExpressionValue;