var ServiceRequest = require('./ServiceRequest');

function ReportService( orgName, username, password ) {
	this.serviceRequest = new ServiceRequest( orgName, username, password );
}

ReportService.prototype.getReportDefinition = function( reportType )
{
	var requestOptions = {
		uri: 'report/definitions/',
		method: "GET",
		qs: {
			reportType:reportType
		}
	};

	return this.serviceRequest.callService( requestOptions );
}


ReportService.prototype.getReportData = function( reportDefinitionId, reportParameters )
{
	var requestOptions = {
		uri: 'report/' + reportDefinitionId + '/data/',
		method: "POST",
		qs: {},
		json: reportParameters
	};

	return this.serviceRequest.callService( requestOptions );
}

ReportService.prototype.getReportDefinitionById = function( reportDefinitionId )
{
	var requestOptions = {
		uri: 'report/definition/' + reportDefinitionId + '/',
		method: "GET",
		qs: {
		}
	};

	return this.serviceRequest.callService( requestOptions );
}


/*

public void getReportDefinitionById (Action<ServiceResult<ReportDefinition>> success, Action<Exception> error, long reportDefinitionId )
		{
			_baseService.MakeRequest<ReportDefinition>( success, error, "GET", "/report/definition/{reportDefinitionId}", 
				new Dictionary<string,string>(){ {"reportDefinitionId", Convert.ToString(reportDefinitionId)} },
				new Dictionary<string,string>(){  },
				null );
		}

public void getReportData (Action<ServiceResult<object>> success, Action<Exception> error, long reportDefinitionId , object reportParameters )
		{
			_baseService.MakeRequest<object>( success, error, "POST", "/report/{reportDefinitionId}/data", 
				new Dictionary<string,string>(){ {"reportDefinitionId", Convert.ToString(reportDefinitionId)} },
				new Dictionary<string,string>(){  },
				reportParameters );
		}


ReportService.prototype.getEncounterFormData = function( encounterFormId )
{
	var requestOptions = {
		uri: 'encounter/form/'+encounterFormId+'/model/data',
		method: "GET",
		qs: {
			withBitmapContent: false
		}
	};

	return this.serviceRequest.callService( requestOptions );
}

ReportService.prototype.getFormDefinitionById = function( formDefinitionId )
{
	var requestOptions = {
		uri: 'form/definition/'+formDefinitionId,
		method: "GET",
		qs: {
			withPageContent: true
		}
	};

	return this.serviceRequest.callService( requestOptions );
}
*/
module.exports = ReportService;