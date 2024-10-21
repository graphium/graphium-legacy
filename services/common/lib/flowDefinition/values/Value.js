var _ = require("lodash");
var ExpressionValue = require('./expression.js');
var PointerValue = require('./pointer.js');

var getValue = function(task, valueConfig) {
    
    var valueGetter = null;
    switch(valueConfig.valueType) {
        case "pointer": valueGetter = new PointerValue(task, valueConfig); break;
        case "expression": valueGetter = new ExpressionValue(task, valueConfig); break;
        default: throw new Error('Invalid valueType specified in flow.');
    }
    return valueGetter.getValue();
}

module.exports = {
    getValue: getValue
};