
var FormDefinitionUtil = require('./FormDefinitionUtil');
var ModelDefinitionUtil = require('./ModelDefinitionUtil');
var requireAll = require('require-all');
var _ = require('lodash');
var path = require('path');

var FormDefinitionLinter = function(config, formDefinitionPath, formDefinitionXml, modelDefinitionContent) {
    var _this = this;
    this.config = config;
    this.formDefinitionPath = formDefinitionPath;
    this.formDefinitionXml = formDefinitionXml;
    this.modelDefinitionContent = modelDefinitionContent;
    this.validationErrors = [];

    this.formDefinitionUtil = new FormDefinitionUtil(formDefinitionXml);
    this.modelDefinitionUtil = new ModelDefinitionUtil(modelDefinitionContent);
    
    this.rules = requireAll({
        dirname     :  __dirname + '/linterRules',
        filter      :  /(.+Rule)\.js$/,
        recursive   : false,
        resolve     : function (Rule) {
            var rule = new Rule(_this.formDefinitionUtil, _this.modelDefinitionUtil, _this);
            rule.setConfig(_this.getRuleConfig(rule.name));
            return rule;
        }
    });
    
    this.ruleNames = _.map(this.rules, 'name');
}

FormDefinitionLinter.prototype.getRuleConfig = function(ruleName) {
    if(this.config.rules && this.config.rules.hasOwnProperty(ruleName)) {
        var ruleConfig = this.config.rules[ruleName];

        if(_.isBoolean(ruleConfig)) {
            return {
                enabled: ruleConfig,
                config: {}
            };
        }
        else if(_.isArray(ruleConfig) && ruleConfig.length == 2 && _.isBoolean(ruleConfig[0]) && _.isPlainObject(ruleConfig[1])) {
            return {
                enabled: ruleConfig[0],
                config: ruleConfig[1]
            };
        }
    }
    else {
        return {
            enabled: true,
            config: {}
        }
    }
}

FormDefinitionLinter.prototype.lint = function() {
    var _this = this;

    this.validateXml();

    this.preProcessRules();
    this.walkInputMethods();
    this.walkSecondaryInputMethodBindings();
    this.postProcessRules();

}

FormDefinitionLinter.prototype.validateXml = function() {
    var _this = this;
    var xmlValidationErrors = this.formDefinitionUtil.validateXml();

    _.forEach(xmlValidationErrors, function(validationError) {
        var event = {
            line: validationError.line,
            column: validationError.column,
            message: 'Schema Validation: ' + _.trim(validationError.message)
        };
        _this.logEvent('error',event);
        _this.validationErrors.push(event);
    });
}

FormDefinitionLinter.prototype.preProcessRules = function() {
    var _this = this;
    _.forEach(_this.rules, function(rule) { 
        rule.preProcess(_this.formDefinitionXml); 
    });
}

FormDefinitionLinter.prototype.postProcessRules = function() {
    var _this = this;
    _.forEach(_this.rules, function(rule) { 
        rule.postProcess(_this.formDefinitionXml); 
    });
}

FormDefinitionLinter.prototype.walkInputMethods = function() {
    var _this = this;
    var inputMethods = this.formDefinitionUtil.getInputMethods();
    _.forEach(inputMethods, function(inputMethodNode) {
        _.forEach(_this.rules, function(rule) { 
            rule.walkInputMethod(inputMethodNode); 
        });
    });
}

FormDefinitionLinter.prototype.walkSecondaryInputMethodBindings = function() {
    var _this = this;
    var secondaryInputMethodBindings = this.formDefinitionUtil.getInputMethodSecondaryBindings();
    _.forEach(secondaryInputMethodBindings, function(binding) {
        _.forEach(_this.rules, function(rule) { 
            rule.walkInputMethodSecondaryBinding(binding); 
        });
    });
}


FormDefinitionLinter.prototype.onRuleWarning = function(warning) {
    this.logEvent('warning',warning);
}

FormDefinitionLinter.prototype.onRuleError = function(error) {
    this.logEvent('error',error);
}

FormDefinitionLinter.prototype.getErrors = function() {
    var linterErrors = _.flatten(_.map(this.rules, function(rule) { return rule.errors; }));
    return _.concat(this.validationErrors, linterErrors);
}

FormDefinitionLinter.prototype.getWarnings = function() {
    return _.flatten(_.map(this.rules, function(rule) { return rule.warnings; }));
}

FormDefinitionLinter.prototype.logEvent = function(severity, event) {
    //var filePath = this.config.resolveFileToPath ? path.resolve(path.relative(this.config.resolveFileToPath, this.formDefinitionPath)) : this.formDefinitionPath;
    console.log(`${path.resolve(this.formDefinitionPath)}:${event.line}:${event.column}: ${severity}: ${event.message}`)
}

module.exports = FormDefinitionLinter;