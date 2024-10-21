var ServiceRequest = require('./ServiceRequest');

function FormService( orgName, username, password ) 
{
	this.serviceRequest = new ServiceRequest( orgName, username, password );
}

FormService.prototype.updateEncounterFormModel = function( encounterFormId, modelPropertyUpdates ) 
{
	var requestOptions = {
		uri: 'encounter/form/' + encounterFormId + '/model/update',
		method: 'POST',
		qs: {
		},
		json: modelPropertyUpdates
	};

	return this.serviceRequest.callService( requestOptions );
}

FormService.prototype.getEncounterForms = function( encounterId ) 
{
	var requestOptions = {
		uri: 'encounter/' + encounterId + '/forms',
		method: 'GET',
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

FormService.prototype.getModelDefinitionByName = function( modelDefinitionName )
{
	var requestOptions = {
		uri: 'model/definition/name/' + modelDefinitionName,
		method: 'GET',
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );	
}

FormService.prototype.getEncounterFormById = function( encounterFormId, withStrokes, withModelData ) 
{
	var requestOptions = {
		uri: 'encounter/form/' + encounterFormId,
		method: 'GET',
		qs: {
			withStrokes:withStrokes, withModelData:withModelData
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

FormService.prototype.createFormForEncounter = function( encounterId, form ) 
{
	var requestOptions = {
		uri: 'encounter/' + encounterId + '/forms',
		method: 'POST',
		qs: {
		},
		json: form
	};

	return this.serviceRequest.callService( requestOptions );
}


FormService.prototype.getFacilityFormDefinitions = function( facilityId ) 
{
	var requestOptions = {
		uri: 'facility/' + facilityId + '/formDefinitions',
		method: 'GET',
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

FormService.prototype.getFormDefinitionVersion = function( formDefinitionId , versionNumber , withPageContent ) 
{
	var requestOptions = {
		uri: 'form/' + formDefinitionId + '/version/' + versionNumber,
		method: 'GET',
		qs: {
			withPageContent: withPageContent
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

FormService.prototype.addEncounterFormPage = function( encounterFormId, form )
{

	var requestOptions = {
		uri: 'encounter/form/' + encounterFormId + '/pages',
		method: 'POST',
		qs: {
		},
		json: form
	};

	return this.serviceRequest.callService( requestOptions );
}

module.exports = FormService;