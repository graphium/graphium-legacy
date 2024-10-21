var graphium = require('@graphiumhealth/graphium-sdk');

var retrieveExistingEncounter = function(encounterNumber) {
    
    if( !encounterNumber )
        return Promise.resolve(null);
    
    this.searchService = new graphium.SearchService(this.importConfig.import.organizationNameInternal,
													process.env.GRAPHIUM_SVC_USER,
													process.env.GRAPHIUM_SVC_TOKEN);
};


module.exports = {
    isConfigValid: function() {
        return true;  
    },
    run: function() {
        return new Promise(function(resolve, reject) {
       
        })
    }
};