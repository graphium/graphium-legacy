var type = require('component-type');
var moment = require('moment');
var _ = require('lodash');

function ModelDefinitionUtil( model ) 
{
	this.model = model;
}

ModelDefinitionUtil.prototype.getAllPropertyNames = function() {
	return _.map(this.model.properties, 'name');
}

ModelDefinitionUtil.prototype.getModelPropertyType = function( propertyName )
{
	var property = this.getPropertyByName(propertyName);
	if( property )
		return property.type;
	return null;
}

ModelDefinitionUtil.prototype.isPropertyRepeatable = function( propertyName )
{
	var property = this.getPropertyByName(propertyName);
	if( property )
		return property.isRepeatable;
	return false;
}

ModelDefinitionUtil.prototype.hasModelProperty = function(propertyName) {
	return this.getPropertyByName(propertyName) != null;
}

ModelDefinitionUtil.prototype.getPropertyByName = function( propertyName )
{
	for( var i = 0; i < this.model.properties.length; i++ ) {
		if( this.model.properties[i].name == propertyName )
			return this.model.properties[i];
	}
	return null;
}

ModelDefinitionUtil.prototype.isValidModelPropertyUpdate = function( modelPropertyUpdate )
{
	var propertyDefinition = this.getPropertyByName(modelPropertyUpdate.propertyName);

	if( modelPropertyUpdate.propertySequence != null ) {
		return propertyDefinition != null && propertyDefinition.isRepeatable;
	}
	else {
		return propertyDefinition != null;
	}
}

ModelDefinitionUtil.prototype.formatModelPropertyUpdate = function( propertyName, propertyValue, propertySequence, pageId )
{
	// We do two things, first we make sure that the pageId is only set if a sequence is set, and then we
	// cast the fieldValue into an appropriate value that the middle-tier is expecting.
	var update = {
		propertyName: propertyName,
		pageId: pageId,
		propertySequence: propertySequence,
		fieldValue: propertyValue
		// formValid: true,
		// percentComplete: 100
	};

	//TEMP Disabling because it looks like there is a problem in the XML.
	//if( propertySequence == null )
	//	update.pageId = undefined;

	update.fieldValue = this.castPropertyValueForUpdate(propertyName, propertyValue);
	return update;
}

ModelDefinitionUtil.prototype.castPropertyValueForUpdate = function( propertyName, propertyValue )
{
	var modelPropertyType = this.getModelPropertyType(propertyName);
	var isPropertyRepeatable = this.isPropertyRepeatable(propertyName);

	if( !modelPropertyType )
		return propertyValue;

	// Here we cast the model property into an appropriate format for sending to the server.
	if( propertyValue != null ) {

		var propertyValueType = type(propertyValue);

		switch( modelPropertyType ) {
			case "date" :
				if(propertyValueType == 'string') {
					var parsedDate = moment(propertyValue, ['YYYY-MM-DD','MM-DD-YYYY','MM/DD/YYYY','YYYY-MM-DDTHH:mm:ss.sZ'], true);
					if(parsedDate.isValid())
						return isPropertyRepeatable ? parsedDate.format('YYYY-MM-DD') : parsedDate.format('YYYY-MM-DDT00:00:00.0[Z]');
					else
						return null;
				}
				else if(propertyValueType == 'date') {
					return isPropertyRepeatable ? moment(propertyValue).format('YYYY-MM-DD') : parsedDate.format('YYYY-MM-DDT00:00:00.0[Z]');
				}
				return null;
			case "time" :
				if(propertyValueType == 'string') {
					var parsedDate = moment(propertyValue, ['HH:mm:ss','YYYY-MM-DDTHH:mm:ss.sZ'], true);
					if(parsedDate.isValid())
						return isPropertyRepeatable ? parsedDate.format('HH:mm:ss') : parsedDate.format('1900-01-01THH:mm:ss.0[Z]');
					else
						return null;
				}
				else if(propertyValueType == 'date') {
					return isPropertyRepeatable ? moment(propertyValue).format('HH:mm:ss') : parsedDate.format('1900-01-01THH:mm:ss.0[Z]');
				}
				return null;
			case "text" :
			case "varchar" :
				if( propertyValueType == 'string' ) {
					return propertyValue.trim();
				}
				else if( propertyValueType == 'number' ) {
					return propertyValue.toString().trim();
				}
				return null;
			case "numeric" :
				if(propertyValueType == 'number') {
					return propertyValue;
				}
				else if(propertyValueType == 'string') {
					if( isNaN(parseFloat(propertyValue)) )
						return null;
					else
						return parseFloat(propertyValue);
				}
				break;
			case "integer" :
			case "smallint" :
			case "bigint" :
				if(propertyValueType == 'number') {
					return propertyValue;
				}
				else if(propertyValueType == 'string') {
					if( isNaN(parseInt(propertyValue)) )
						return null;
					else
						return parseInt(propertyValue);
				}
				break;
			case "boolean":
				if(propertyValueType == 'boolean') {
					return propertyValue;
				}
				else if( propertyValueType == 'string') {
					if( propertyValue.toLowerCase() === 'true' )
						return true;
					else if( propertyValue.toLowerCase() === 'false' )
						return false;
					return null;
				}
				break;
			default:
				return propertyValue;
		}
	}
	else {
		return null;
	}
}

module.exports = ModelDefinitionUtil;