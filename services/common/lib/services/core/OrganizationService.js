var ServiceRequest = require('./ServiceRequest');

function OrganizationService( orgName, username, password ) 
{
	this.serviceRequest = new ServiceRequest( orgName, username, password );
}

OrganizationService.prototype.getUserOrganizations = function( callback )
{
	var requestOptions = {
		uri: 'organization/organizations',
		method: "GET",
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

module.exports = OrganizationService;