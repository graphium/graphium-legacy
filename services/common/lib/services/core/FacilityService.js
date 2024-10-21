var ServiceRequest = require('./ServiceRequest');

function FacilityService( orgName, username, password ) 
{
	this.serviceRequest = new ServiceRequest( orgName, username, password );
}

FacilityService.prototype.getFacilities = function()
{
	var requestOptions = {
		uri: 'facility/facilities',
		method: "GET",
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

FacilityService.prototype.getProvidersForFacility = function( facilityId )
{
	var requestOptions = {
		uri: 'facility/' + facilityId + '/providers',
		method: "GET",
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

FacilityService.prototype.createProvider = function( facilityId, provider )
{
	var requestOptions = {
		uri: 'facility/' + facilityId + '/providers',
		method: "POST",
		qs: {
		},
		json: provider
	};

	return this.serviceRequest.callService( requestOptions );
}

module.exports = FacilityService;