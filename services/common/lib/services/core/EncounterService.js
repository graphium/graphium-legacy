var ServiceRequest = require('./ServiceRequest');

function EncounterService( orgName, username, password ) 
{
	this.serviceRequest = new ServiceRequest( orgName, username, password );
}

EncounterService.prototype.createEncounter = function( encounter ) 
{
	var requestOptions = {
		uri: 'encounter',
		method: 'POST',
		qs: {
		},
		json: encounter
	};

	return this.serviceRequest.callService( requestOptions );
}

EncounterService.prototype.getEncounterIdByEncounterNumber = function( facilityId, encounterNumber )
{
	var requestOptions = {
		uri: 'facility/' + facilityId.toString() + '/encounter/number/' +  encodeURIComponent(encounterNumber.toString()) + '/id',
		method: "GET",
		qs: {
		}
	};
	return this.serviceRequest.callService( requestOptions );
}

EncounterService.prototype.getEncountersByMedicalRecordNumber = function( facilityId, medicalRecordNumber )
{
    var requestOptions = {
		uri: 'encounter/medicalRecordNumber/' +  encodeURIComponent(medicalRecordNumber.toString()),
		method: "GET",
		qs: {
		}
	};
	return this.serviceRequest.callService( requestOptions );
}

EncounterService.prototype.updateEncounter = function( encounterId, encounter ) 
{
	var requestOptions = {
		uri: 'encounter/' + encounterId,
		method: 'PUT',
		qs: {
		},
		json: encounter
	};

	return this.serviceRequest.callService( requestOptions );
}

EncounterService.prototype.patchEncounter = function( encounterId, encounter )
{
	var requestOptions = {
		uri: 'encounter/patch/' + encounterId,
		method: 'PUT',
		qs: {
		},
		json: encounter
	};

	return this.serviceRequest.callService( requestOptions );
}

/*
public function updateEncounter( encounterId:Number,  encounter:Encounter ):AsyncToken
		{
			return getTokenForOperation( "PUT", "/encounter/{encounterId}", 
				   { encounterId:encounterId },
				   {  },
				   encounter,
				   Encounter,false
				    );
		}

*/

EncounterService.prototype.getEncountersForFacility = function( facilityId )
{
	var requestOptions = {
		uri: 'facility/' + facilityId + '/encounters',
		method: "GET",
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

EncounterService.prototype.getEncounterById = function( encounterId )
{
	var requestOptions = {
		uri: 'encounter/' + encounterId,
		method: "GET",
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

EncounterService.prototype.getEncounter = EncounterService.prototype.getEncounterById;

EncounterService.prototype.getEncounterForms = function( encounterId )
{
	var requestOptions = {
		uri: 'encounter/'+encounterId+'/forms',
		method: "GET",
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

EncounterService.prototype.getOpenedEncounters = function()
{
	var requestOptions = {
		uri: 'encounter/opened',
		method: 'GET',
		qs: {

		}
	}

	return this.serviceRequest.callService( requestOptions );
}

module.exports = EncounterService;