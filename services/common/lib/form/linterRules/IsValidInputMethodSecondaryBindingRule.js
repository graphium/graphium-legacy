var RuleBase = require('./RuleBase');
var xpath = require('xpath');

function IsValidInputMethodSecondaryBindingRule(formDefinitionUtil, modelDefinitionUtil, listener) {
    RuleBase.call(this, formDefinitionUtil, modelDefinitionUtil, listener);
    this.name = 'is-valid-secondary-input-method-binding';
}

IsValidInputMethodSecondaryBindingRule.prototype = Object.create(RuleBase.prototype);
IsValidInputMethodSecondaryBindingRule.prototype.constructor = RuleBase;

IsValidInputMethodSecondaryBindingRule.prototype.walkInputMethodSecondaryBinding = function(bindingNode) {
    
    switch(bindingNode.localName) {
        case 'valueListItemBinding':    this.validateStandardBinding(bindingNode); break;
        case 'expressionBinding':       this.validateStandardBinding(bindingNode); break;
        case 'modelBinding':            this.validateModelBinding(bindingNode); break;
        case 'modelMapBinding':         this.validateModelMapBinding(bindingNode); break;
        default: 
            this.addWarning(bindingNode.lineNumber, bindingNode.columnNumber, `Unknown input method binding type (${binding.localName})`);
    }
}

IsValidInputMethodSecondaryBindingRule.prototype.validateStandardBinding = function(bindingNode) {
    var toModelProperty = bindingNode.hasAttribute('toModelProperty') ? xpath.select("string(@toModelProperty)", bindingNode) : null;
    var toSequenceNumber = bindingNode.hasAttribute('toSequenceNumber') ? xpath.select("number(@toSequenceNumber)", bindingNode) : null;

    this.validateModelPropertyAndSequence(toModelProperty, toSequenceNumber, bindingNode.lineNumber, bindingNode.columnNumber);
}

IsValidInputMethodSecondaryBindingRule.prototype.validateModelBinding = function(bindingNode) {
    this.validateStandardBinding(bindingNode);

    var fromModelProperty = bindingNode.hasAttribute('toModelProperty') ? xpath.select("string(@toModelProperty)", bindingNode) : null;
    var fromSequenceNumber = bindingNode.hasAttribute('toSequenceNumber') ? xpath.select("number(@toSequenceNumber)", bindingNode) : null;

    if(fromModelProperty) {
        this.validateModelPropertyAndSequence(fromModelProperty, fromSequenceNumber, bindingNode.lineNumber, bindingNode.columnNumber);
    }

}

IsValidInputMethodSecondaryBindingRule.prototype.validateModelMapBinding = function(bindingNode) {
    var modelMapKeyProperty = bindingNode.hasAttribute('modelMapKeyProperty') ? xpath.select("string(@modelMapKeyProperty)", bindingNode) : null;
    var modelMapValueProperty = bindingNode.hasAttribute('modelMapValueProperty') ? xpath.select("string(@modelMapValueProperty)", bindingNode) : null;

    this.validateIsRepeatable(modelMapKeyProperty, bindingNode.lineNumber, bindingNode.columnNumber);
    this.validateIsRepeatable(modelMapValueProperty, bindingNode.lineNumber, bindingNode.columnNumber);
}

module.exports = IsValidInputMethodSecondaryBindingRule;