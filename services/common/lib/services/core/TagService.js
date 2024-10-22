const { ServiceRequest } = require('./ServiceRequest');

function TagService( orgName, username, password ) 
{
	this.serviceRequest = new ServiceRequest( orgName, username, password );
}

TagService.prototype.getTags = function( callback )
{
	var requestOptions = {
		uri: 'tags',
		method: "GET",
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

TagService.prototype.addTagToForm = function( formId, tagId )
{
	var requestOptions = {
		uri: 'form/' + formId + '/tag/' + tagId,
		method: 'PUT',
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

module.exports = TagService;