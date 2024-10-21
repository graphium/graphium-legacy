var crypto = require('crypto');

module.exports =  {

    generate: function(obj, key) {
        return crypto.createHmac( 'sha256', key ).update(JSON.stringify(obj)).digest('base64'); 
    },

    generateFromString: function(str, key) {
        return crypto.createHmac( 'sha256', key ).update(str).digest('base64'); 
    },

    generateObjectHash: function(obj) {
        var dataString = "";
        if(obj) {
            dataString = JSON.stringify(obj);
        }

        return crypto.createHash('md5').update(dataString).digest("hex");
    }

};