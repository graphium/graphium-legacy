var ServiceRequest = require('./ServiceRequest');

function UserService( orgName, username, password ) 
{
	this.serviceRequest = new ServiceRequest( orgName, username, password );
}

UserService.prototype.getOrganizationUsers = function( pageNumber,  pageCount )
{
	var requestOptions = {
		uri: 'organization/users/',
		method: 'GET',
		qs: {
			pageNumber: pageNumber,
			pageCount: pageCount
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

module.exports = UserService;