var Promise = require('bluebird');
var vm = require('vm');

var isFormatterValid = function(formatterConfig) {
    return formatterConfig != null &&
        formatterConfig.hasOwnProperty("formatterType") &&
        formatterConfig.formatterType == "expression" &&
        formatterConfig.hasOwnProperty("expression") &&
        formatterConfig.expression !== "" && formatterConfig.expression !== null;
}

module.exports = function(formatterConfig, value) {
    return new Promise(function(resolve,reject) {
        console.log('- Executing formatter: ' + JSON.stringify({formatterConfig:formatterConfig,value:value}));
        if( !isFormatterValid(formatterConfig) )
            throw(new Error('Formatter config is invalid: ' + JSON.stringify(formatterConfig)));

        // We catch the error so that we can resolve this promise and not reject it.
        try {
            var expression = formatterConfig.expression;
            console.log('Attempting to execute expression: ' + expression);
            var v = vm.runInNewContext(expression, {input:JSON.parse(JSON.stringify(value))});
            console.log('Executed formatter expression: ' + v);
            resolve(v);
        }
        catch( error ) {
            console.log(error);
            console.log("Warning: Unable to execute formatter expression: " + JSON.stringify({expression:expression,value:value,error:error}));
            resolve(value);
        }
    });   
}