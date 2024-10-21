var express = require('express');
var passport = require('passport');
var auth = require('../util/authMiddleware');
var router = express.Router();
var TransactionLog = require('../log/TransactionLog.js');
var IndexUserDAO = require('../dao/index/IndexUserDAO.js');

/* GET user profile. */
router.get('/', auth.ensureAuthenticatedOrg(), function(req, res, next) {
    res.render('user/index', {
    });
});

router.get('/restricted', auth.ensureAuthenticatedOrg(), function(req, res, next) {
    res.render('user/restricted', {
    });
});

router.post('/auth0/login', function(req, res) {
    var tl = new TransactionLog('LOGIN', {
        httpRequest: 'POST auth0/login'
    });

    var username = req.body.username;
    var password = req.body.password;

    tl.appendLogData({ username:username });
    tl.logInfo('START_AUTH','Attempting to authenticate user.');

    IndexUserDAO.authenticateIndexUser(username, password)
    .then(function(user) {
        tl.logInfo('AUTH_SUCCESS', 'Authenticated user: ' + username);
        tl.finishTransaction();
        res.send(user);
    })
    .catch(function(error) {
        res.send(500,'Unable to authenticate: ' + error.message);
        tl.logError('AUTH_ERROR', 'Unable to authenticate: ' + error.message);
        tl.finishTransaction(); 
    })

});

module.exports = router;