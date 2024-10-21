var _ = require('lodash');

function RuleBase(formDefinitionUtil, modelDefinitionUtil, listener) {
    if(!formDefinitionUtil || !modelDefinitionUtil) {
        throw new Error('Form and model utils not passed in.');
    }

    this.formDefinitionUtil = formDefinitionUtil;
    this.modelDefinitionUtil = modelDefinitionUtil;
    this.warnings = [];
    this.errors = [];
    this.currentPage = null;
    this.listener = listener;
}

RuleBase.prototype.setConfig = function(config) {
    this.enabled = config.enabled;
    this.config = config.config;
}

RuleBase.prototype.preProcess = function(form) {
}

RuleBase.prototype.postProcess = function(form) {
}

RuleBase.prototype.walkInputMethod = function(inputMethod, inputMethodNode) {
}

RuleBase.prototype.walkInputMethodSecondaryBinding = function(binding, bindingNode) {
}

RuleBase.prototype.walkPage = function(page, pageNode) {
}

RuleBase.prototype.validateModelPropertyAndSequence = function(modelProperty, sequenceNumber, line, column) {

    if(!modelProperty) {
        this.addError(line,column,`Element does not specify a model property.`);
        return;
    }

    var modelPropertyExists = this.modelDefinitionUtil.hasModelProperty(modelProperty);
    var isRepeatable = this.modelDefinitionUtil.isPropertyRepeatable(modelProperty);

    if(!modelPropertyExists) {
        this.addError(line,column,`Element references a model property (${modelProperty}) that does not exist on the model.`);
    }
    else {
        if(isRepeatable && sequenceNumber == null) {
            this.addError(line,column, `Element references repeatable model property (${modelProperty}), but no sequence number defined.`);
        }
        else if(!isRepeatable && sequenceNumber != null) {
            this.addError(line,column, `Sequence number defined on element with non-repeatable model property (${modelProperty}).`);
        }
    }
}

RuleBase.prototype.validateIsRepeatable = function(modelProperty, line, column) {

    if(!modelProperty) {
        this.addError(line,column,`Element does not specify a model property.`);
        return;
    }

    var modelPropertyExists = this.modelDefinitionUtil.hasModelProperty(modelProperty);
    var isRepeatable = this.modelDefinitionUtil.isPropertyRepeatable(modelProperty);

    if(!modelPropertyExists) {
        this.addError(line,column,`Element references a model property (${modelProperty}) that does not exist on the model.`);
    }
    else if(!isRepeatable) {
        this.addError(binding.lineNumber, binding.columnNumber, `Property (${modelProperty}) references a non-repeatable property.`);
    }
}


RuleBase.prototype.addWarning = function(line, column, message, data) {
    var warning = {
        ruleName: this.name,
        line: line,
        column: column,
        message: message,
        data: data
    };

    this.warnings.push(warning);

    if(this.listener && _.isFunction(this.listener.onRuleWarning))
        this.listener.onRuleWarning.call(this.listener, warning);
}

RuleBase.prototype.addError = function(line, column, message, data) {
    var error = {
        ruleName: this.name,
        line: line,
        column: column,
        message: message,
        data: data
    };

    this.errors.push(error);

    if(this.listener && _.isFunction(this.listener.onRuleError))
        this.listener.onRuleError.call(this.listener, error);
}

module.exports = RuleBase;