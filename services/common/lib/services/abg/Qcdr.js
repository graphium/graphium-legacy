var AbgRequest = require('./AbgRequest')
var request = require('request-promise');
var _ = require('lodash');

function AbgQcdr(config) {
  this.config = config;

  if(!this.config.username)
    throw new Error('Unable to make request, config does not specify a username.');
  if(!this.config.password)
    throw new Error('Unable to make request, config does not specify a password.');
}

AbgQcdr.prototype.uploadEncounters = function(encounters) {
    var abgRequest = new AbgRequest();
    return abgRequest.requestToken(this.config.username, this.config.password)
    .then(function(accessToken) {
      var options = {
          headers: {
            'access_token': accessToken
          },
          method: 'POST',
          uri: abgRequest.getBaseUri() + '/upload/post',
          body: encounters,
          json: true
      };
      return request(options);
    });
}

module.exports = AbgQcdr;