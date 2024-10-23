var request = require('request-promise');
var moment = require('moment');

var AbgRequest = function() {
}

AbgRequest.abgQcdrTokenMap = {};


AbgRequest.prototype.getBaseUri = function() {
  if(!EnvironmentConfig.getProperty('abg','ABG_SERVICE_URI')) {
    throw new Error('Unable to complete ABG request, ABG_SERVICE_URI not defined.');
  }
  return EnvironmentConfig.getProperty('abg','ABG_SERVICE_URI');
}

AbgRequest.prototype._generateToken = function(username, password) {
  console.log('Generating token for ABG request from ' + this.getBaseUri() + '/token');
  console.log('Params: ');
  var params = {
    grant_type: 'password',
    username: username,
    password: password
  };
  console.log(params);
  return request.post(this.getBaseUri()+'/token', {
    form: params,
    json: true
  })
  .then(function(result) {
    console.log(' - Token generated: ' + JSON.stringify(result));
    if(result.expires_in) {
      // We actually reduce the expiration time by 10% so that we have time to
      // referesh our token.
      result.expires = new Date().getTime() + (result.expires_in * 0.9) * 1000;
      result.expires_friendly = moment(result.expires).toString();
    }
    //console.log('Generated new token: ');
    //console.log(result);
    return Promise.resolve(result);
  })
}

AbgRequest.prototype.requestToken = function(username, password) {
  var key = new Buffer([username,password].join(':')).toString('base64');
  var token = AbgRequest.abgQcdrTokenMap[key];

  if(!token || token.expires > new Date().getTime()) {
    return this._generateToken(username, password)
    .then(function(token) {
      AbgRequest.abgQcdrTokenMap[key] = token;
      return Promise.resolve(token.access_token);
    });
  }
  else {
    return Promise.resolve(token.access_token);
  }
}

module.exports = AbgRequest;