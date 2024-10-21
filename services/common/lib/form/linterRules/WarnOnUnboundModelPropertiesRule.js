var RuleBase = require('./RuleBase');
var xpath = require('xpath');
var _ = require('lodash');

function WarnOnUnboundModelPropertiesRule(formDefinitionUtil, modelDefinitionUtil, listener) {
    RuleBase.call(this, formDefinitionUtil, modelDefinitionUtil, listener);
    this.name = 'warn-on-unbound-model-properties';
    this.boundModelProperties = [];
}

WarnOnUnboundModelPropertiesRule.prototype = Object.create(RuleBase.prototype);
WarnOnUnboundModelPropertiesRule.prototype.constructor = RuleBase;

// Let's get all the model properties from the default input methods.
WarnOnUnboundModelPropertiesRule.prototype.walkInputMethod = function(inputMethod) {
    var propertyName = inputMethod.hasAttribute('modelProperty') ? xpath.select("string(@modelProperty)", inputMethod) : null;
    var modelMapValueProperty = inputMethod.hasAttribute('modelMapValueProperty') ? xpath.select("string(@modelMapValueProperty)", inputMethod) : null;
    this.boundModelProperties.push(propertyName, modelMapValueProperty);
}

WarnOnUnboundModelPropertiesRule.prototype.walkInputMethodSecondaryBinding = function(bindingNode) {
    
    switch(bindingNode.localName) {
        case 'valueListItemBinding':    this.addStandardBindingProperties(bindingNode); break;
        case 'expressionBinding':       this.addStandardBindingProperties(bindingNode); break;
        case 'modelBinding':            this.addModelBindingProperties(bindingNode); break;
        case 'modelMapBinding':         this.addModelMapBindingProperties(bindingNode); break;
    }
}

WarnOnUnboundModelPropertiesRule.prototype.addStandardBindingProperties = function(bindingNode) {
    var toModelProperty = bindingNode.hasAttribute('toModelProperty') ? xpath.select("string(@toModelProperty)", bindingNode) : null;
    this.boundModelProperties.push(toModelProperty);
}

WarnOnUnboundModelPropertiesRule.prototype.addModelBindingProperties = function(bindingNode) {
    this.addStandardBindingProperties(bindingNode);

    var fromModelProperty = bindingNode.hasAttribute('toModelProperty') ? xpath.select("string(@toModelProperty)", bindingNode) : null;
    this.boundModelProperties.push(fromModelProperty);
}

WarnOnUnboundModelPropertiesRule.prototype.addModelMapBindingProperties = function(bindingNode) {
    var modelMapKeyProperty = bindingNode.hasAttribute('modelMapKeyProperty') ? xpath.select("string(@modelMapKeyProperty)", bindingNode) : null;
    var modelMapValueProperty = bindingNode.hasAttribute('modelMapValueProperty') ? xpath.select("string(@modelMapValueProperty)", bindingNode) : null;
    this.boundModelProperties.push(modelMapKeyProperty, modelMapValueProperty);
}

WarnOnUnboundModelPropertiesRule.prototype.postProcess = function(form) {
    var _this = this;
    var allModelProperties = this.modelDefinitionUtil.getAllPropertyNames();
    var propertiesToDiff = _.isArray(this.config.properties) ? this.config.properties : allModelProperties;

    this.boundModelProperties = _.intersection(_.uniq(_.compact(this.boundModelProperties)), allModelProperties);
    var modelPropertiesNotBound = _.difference(propertiesToDiff, this.boundModelProperties);
    
    if(modelPropertiesNotBound && modelPropertiesNotBound.length > 0) {
        _.forEach(modelPropertiesNotBound, function(propertyName) {
            _this.addWarning(0,0,`Form does not have an input that binds to property (${propertyName})`);
        })
    }
}


module.exports = WarnOnUnboundModelPropertiesRule;