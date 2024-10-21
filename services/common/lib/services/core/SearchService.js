var ServiceRequest = require('./ServiceRequest');

function SearchService( orgName, username, password ) 
{
	this.serviceRequest = new ServiceRequest( orgName, username, password );
}

SearchService.prototype.getSearchDefinitions = function()
{
	var requestOptions = {
		uri: 'search/definitions',
		method: 'GET',
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

SearchService.prototype.getSearchResults = function( searchDefinitionId, searchParameters, pageNumber, pageCount )
{
	var requestOptions = {
		uri: 'search/definition/' + searchDefinitionId + '/results',
		method: "POST",
		qs: {
            pageNumber: pageNumber,
            pageCount: pageCount
//
// For some reason these aren't coming through correctly when 'undefined'. 
// I think we will need a better way of dealing with undefined query variables.
//
//			pageNumber: pageNumber,
//			pageCount: pageCount
		},
		json: searchParameters
	};

	return this.serviceRequest.callService( requestOptions );
}

module.exports = SearchService;