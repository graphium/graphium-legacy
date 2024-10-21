var ServiceRequest = require('./ServiceRequest');

function ValueSetService( orgName, username, password ) 
{
	this.serviceRequest = new ServiceRequest( orgName, username, password );
}

ValueSetService.prototype.getValueSetByCategoryAndName = function( categoryName,  valueSetName, facilityId )
{
	var requestOptions = {
		uri: 'value_set/' + categoryName + '/name/' + valueSetName,
		method: 'GET',
		qs: {
			facilityId: facilityId
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

module.exports = ValueSetService;