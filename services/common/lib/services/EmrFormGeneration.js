/* 
These are simple wrappers around the REST APIs that are exposed through the 
beanstalk instances, etc. Makes it easier for Lambda, et.al. to access these APIs.
The code for the actual APIs are exposed in their specific repository, ie. flow-core-services-private
*/
var request = require('request-promise');
var signature = require('../util/signature.js');

function getBaseUrl()
{
    if( !process.env.EMR_FORM_GENERATION_URI )
        throw new Error('Unable to create wrapper for gic-services, uri env vars not defined.');
    return process.env.EMR_FORM_GENERATION_URI;
}

module.exports = {
    getForm: function(orgInternalName, formId, excludedPages) {
        
        var qs = {};
        // required params
        qs.org = orgInternalName;
        qs.formId = formId;
        
        // optional params
        if(excludedPages) qs.excludedPages = excludedPages.join(',');
        
        // generate signature
        var signatureObject = {formId:formId.toString(),org:orgInternalName};
        qs.signature = signature.generate(signatureObject, process.env.CORE_SVC_API_KEY);
        
        var options = {
            method: 'GET',
            uri: getBaseUrl() + '/form/'+formId,
            qs: qs,
            encoding: null
        };
        
        return request(options);
    }
}