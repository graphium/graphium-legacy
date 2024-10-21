$().ready(function() {

  var options = {
    closable: false,
    responseType: 'code',
    rememberLastLogin: false,
    forgotPasswordLink: '/reset',
    languageDictionary: {
      title: 'Graphium Health',
    },
    auth: {
      redirectUrl: "https://" + window.location.host + "/callback"
    },
    theme: {
      logo: '/images/logo-graphium-auth0_new.png',
      primaryColor: '#33CCED',
      usernameStyle: 'username',
      labeledSubmitButton: false,
    }
  };
  var lock = new Auth0Lock(auth0ClientId, auth0Domain, options);
  lock.show();
})