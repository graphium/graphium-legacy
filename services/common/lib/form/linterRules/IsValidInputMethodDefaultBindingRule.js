var RuleBase = require('./RuleBase');
var xpath = require('xpath');

function IsValidInputMethodDefaultBindingRule(formDefinitionUtil, modelDefinitionUtil, listener) {
    RuleBase.call(this, formDefinitionUtil, modelDefinitionUtil, listener);
    this.name = 'is-valid-default-input-method-binding';
}

IsValidInputMethodDefaultBindingRule.prototype = Object.create(RuleBase.prototype);
IsValidInputMethodDefaultBindingRule.prototype.constructor = RuleBase;

IsValidInputMethodDefaultBindingRule.prototype.walkInputMethod = function(inputMethod) {
    var propertyName = inputMethod.hasAttribute('modelProperty') ? xpath.select("string(@modelProperty)", inputMethod) : null;
    var sequenceNumber = inputMethod.hasAttribute('sequenceNumber') ? xpath.select("number(@sequenceNumber)", inputMethod) : null;
    
    var isModelPropertyMap = inputMethod.hasAttribute('isModelPropertyMap') ? xpath.select("boolean(@isModelPropertyMap)", inputMethod) : null;
    var modelMapValueProperty = inputMethod.hasAttribute('modelMapValueProperty') ? xpath.select("string(@modelMapValueProperty)", inputMethod) : null;

    if(!isModelPropertyMap) {
        this.validateModelPropertyAndSequence(propertyName, sequenceNumber, inputMethod.lineNumber, inputMethod.columnNumber);
    }
    else  {
        if(!modelMapValueProperty) {
            this.addError(inputMethod.lineNumber, inputMethod.columnNumber, `Model map binding does not specify a modelMapValueProperty but isModelPropertyMap is set to true.`);
        }
        else {
            this.validateIsRepeatable(modelMapValueProperty, inputMethod.lineNumber, inputMethod.columnNumber);
            this.validateIsRepeatable(propertyName, inputMethod.lineNumber, inputMethod.columnNumber);
        }
    }
}

module.exports = IsValidInputMethodDefaultBindingRule;