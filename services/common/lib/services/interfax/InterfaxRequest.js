

module.exports = {
  defaultConfig: {
    user: process.env.INTERFAX_USER,
    pass: process.env.INTERFAX_PASS
  },

  getBaseUrl: function() {
    return 'https://rest.interfax.net';
  },
  
  generateSignature: function(username, password) {
    return new Buffer([username,password].join(':')).toString('base64');
  }
}