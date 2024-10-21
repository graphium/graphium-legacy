
var _ = require('lodash');

function Formatter() {
    //no-op
}

Formatter.format = function(formatterConfig, value) {
    console.log('Formatter.formatValue: ' + JSON.stringify({formatterConfig:formatterConfig,value:value}));
    switch(formatterConfig.formatterType) {
        case "expression": var formatterRunner = require('./expression'); break;
        default: throw new Error('Invalid formatter type specified: ' + formatterConfig.formatterType);
    }
    return formatterRunner.call(this, formatterConfig, value);
}

Formatter.runFormatters = function( formatters, initialValue ) {
    return formatters.reduce(function(promise, formatterConfig) {
        return promise.then(function(value) { 
            return Formatter.format(formatterConfig, value); 
        });
    }, Promise.resolve(initialValue));
}

Formatter.formatValue = function( valueConfig, unformattedValue ) {
    
    if( valueConfig.hasOwnProperty("formatters") && _.isArray( valueConfig.formatters) ) {
        return Formatter.runFormatters( valueConfig.formatters, unformattedValue );
    }
    else {
        return Promise.resolve(unformattedValue);
    }
}

module.exports = Formatter;