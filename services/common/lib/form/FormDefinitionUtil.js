var dom = require('xmldom');
var xpath = require('xpath');
var xsd = require('libxml-xsd');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');

var FormDefinitionUtil = function(formDefinitionXmlString) {
    this.formDefinitionXmlString = formDefinitionXmlString;
    this.formDefinitionXml = new dom.DOMParser().parseFromString(formDefinitionXmlString);
}

FormDefinitionUtil.prototype.validateXml = function() {

    var formDefinitionVersion = this.getVersion();
    if(!formDefinitionVersion) {
        throw new Error('Unable to validate schema, form does not define a version attribute.');
    }

    var schemaPath = path.join(__dirname,'schema',['FormDefinition','v'+formDefinitionVersion,'xsd'].join('.'));
    if(!fs.existsSync(schemaPath)) {
        throw new Error('Unable to validate schema, no schema for the specified form verison ('+formDefinitionVersion+') found.');
    }

    var schema = xsd.parse(fs.readFileSync(schemaPath).toString('utf8'));
    var validationErrors = schema.validate(this.formDefinitionXmlString);

    return validationErrors;
}

FormDefinitionUtil.prototype.getVersion = function() {
    return xpath.select('string(/form/@version)',this.formDefinitionXml);
}

FormDefinitionUtil.prototype.getModelName = function() {
    return xpath.select('string(/form/@modelName)',this.formDefinitionXml);
}

/** A list of binding metadata for all inputs. Each metadata object is
    in the following format:
        {
            inputName: string,
            inputMethodIndex?: int,
            bindingIndex?: int,
            isDefaultBinding: boolean,
            modelProperty: string,
            sequenceNumber?: int,
            lineNumber?: int,
            columnIndex?: int
        }
*/

FormDefinitionUtil.prototype.getDiscreteInputs = function() {
    return xpath.select("//discreteInputs//input", this.formDefinitionXml);
}

FormDefinitionUtil.prototype.getPaperInputs = function() {
    return xpath.select("//discreteInputs//input", this.formDefinitionXml);
}


FormDefinitionUtil.prototype.getInputMethods = function() {
    return xpath.select("/form//*[local-name()='inputMethods' or local-name()='inputMethod']/*", this.formDefinitionXml);

    /*
    var bindings = [];
    //console.log(inputMethods[0]);

    _.forEach(inputMethods, function(inputMethodXml) {
        //console.log('Transforming input method: ' + inputMethodXml.localName);
        //console.log(inputMethodXml);
        var input = xpath.select("parent::node()/parent::node()", inputMethodXml, true);
        // Default binding
        var binding = {
            pageName: xpath.select("string(ancestor::page/@name)",input, true),
            inputName: xpath.select("string(@name)", input),
            lineNumber: inputMethodXml.lineNumber,
            columnNumber: inputMethodXml.columnNumber,
            isDefaultBinding: true,
            inputMethodType: inputMethodXml.localName,
            modelProperty: inputMethodXml.hasAttribute('modelProperty') ? xpath.select("string(@modelProperty)", inputMethodXml) : null,
            modelMapValueProperty: inputMethodXml.hasAttribute('modelMapValueProperty') ? xpath.select("string(@modelMapValueProperty)", inputMethodXml) : null,
            isModelPropertyMap: inputMethodXml.hasAttribute('isModelPropertyMap') ? xpath.select("boolean(@isModelPropertyMap)", inputMethodXml) : null,
            sequenceNumber: inputMethodXml.hasAttribute('sequenceNumber') ? xpath.select("number(@sequenceNumber)", inputMethodXml) : null
        };

        bindings.push(binding);
    });
    return bindings;
    */
}

FormDefinitionUtil.prototype.getInputMethodSecondaryBindings = function() {
    return xpath.select("/form//*[local-name()='inputMethods' or local-name()='inputMethod']//bindings/*", this.formDefinitionXml);
}

// Get defined dynamic expressions.
FormDefinitionUtil.prototype.getDefinedDynamicExpressions = function() {
    return xpath.select('/form/@modelName',this.formDefinitionXml)
}

module.exports = FormDefinitionUtil;