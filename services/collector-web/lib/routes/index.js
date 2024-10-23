var express = require('express');
var passport = require('passport');
var router = express.Router();
var auth = require('../util/authMiddleware');
var _ = require('lodash');
var graphium = require('@graphiumhealth/graphium-sdk');

var IndexUserDAO = require('@common/lib/dao/index/IndexUserDAO');
var AuditLogDAO = require('@common/lib/dao/AuditLogDAO');
var OrgUserDao = require('@common/lib/dao/org/OrgUserDAO');
var EnvironmentConfig = require('@common/lib/config/EnvironmentConfig').EnvironmentConfig;


var env = {
    AUTH0_CLIENT_ID: EnvironmentConfig.getProperty('auth0','AUTH0_CLIENT_ID'),
    AUTH0_DOMAIN: EnvironmentConfig.getProperty('auth0','AUTH0_DOMAIN'),
    AUTH0_CALLBACK_URL: EnvironmentConfig.getProperty('auth0','AUTH0_CALLBACK_URL')
};

router.get('/ping', function(req, res, next) {
    res.status(200).send({success:true});
});

router.get('/healthcheck', function(req, res, next) {
    res.status(200).send();
});

router.get('/test', function(req, res, next) {
    res.render('test', {});
});

/* GET home page. */
router.get('/', auth.ensureAuthenticatedOrg(), function(req, res, next) {
    res.redirect('/collector/batches');
});

router.get('/login', function(req, res) {
    res.render('login', {
        env: env
    });
});

router.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

router.get('/organization/select', auth.ensureAuthenticatedIndex(), function(req, res) {

    var sessionUser = req.user;
    var username = sessionUser._json.gh_user.userName;

    IndexUserDAO.getIndexUser(username)
    .then(function(user) {
        res.render('selectOrganization', {
            title: 'Select Your Organization',
            organizations: user.organizations
        })
    })
    .catch(function(error) {
        res.redirect('/login', { errorMessages:['Unable to retrieve organizations for user.'] });
    });
})

router.post('/organization/select', auth.ensureAuthenticatedIndex(), function(req, res) {
    var orgNameInternal = req.body.organizationNameInternal;
    var errorMessages = [];

    if(!orgNameInternal) {
        errorMessages.push('Invalid organization selected.');
        res.redirect('/organization/select', { errorMessages:errorMessages });
        return;
    }

    req.session.org = orgNameInternal;

    OrgUserDao.getOrgUser(orgNameInternal, req.user._json.gh_user.userName)
    .then(function(orgUser) {
        return AuditLogDAO.createUserLoginAuditLog(orgNameInternal, orgUser.userId);
    })
    .then(function(auditSuccess) {
        // Whether it succeeds or not we go ahead and move along.
        res.redirect('/');
    })
    .catch(function(error) {
        res.redirect('/organization/select', { errorMessages:['You do not have access to that organization.']});
    })
})

router.get('/queryBuilder', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}),
    function(req, res, next) {
        res.render('queryBuilder/queryBuilder');
    });

router.get('/encounters', auth.ensureAuthenticatedOrg({roles:{some:['ORG_ADMIN']}}),
    function(req, res, next) {
        res.render('encounters/encounters');
    });

router.get('/callback', function(req, res, next) {
        // We are intercepting the middware and modifying the request
        // properties to force the passport OAuth2 strategy to correctly 
        // generate the protocol portion of the callback URL, otherwise 
        // Passport will make it HTTP instead of HTTPS which
        // will cause authentication to fail.
        req.connection.encrypted = true;
        var middleware = passport.authenticate('auth0', {
            failureRedirect: '/login#failure'
        });
        middleware(req, res, next);
    },
    function(req, res) {

        console.log('Processing auth0 callback...');
        console.log(req.user);

        var user = req.user;
        console.log('Getting user organizations...');
        var userOrganizations = (user._json.gh_user.organizations);
        console.log('Getting last opened org...');
        var lastOpenedOrgInternalName = req.cookies[user._json.gh_user.userName+'.lastOpenedOrg'];
        var lastOpenedOrg = lastOpenedOrgInternalName ? _.find(userOrganizations, {organizationNameInternal: lastOpenedOrgInternalName}) : null;
        var currentSessionOrg = req.session.org ? _.find(userOrganizations, { orgInternalName: req.session.org }) : null;

        if(!currentSessionOrg) {
            if(lastOpenedOrg) {
                req.session.org = lastOpenedOrg.organizationNameInternal;
            }
            else {
                req.session.org = userOrganizations[0].organizationNameInternal;
            }
            currentSessionOrg = req.session.org;
            req.session.save();
        }

        OrgUserDao.getOrgUser(currentSessionOrg, user._json.gh_user.userName)
        .then(function(orgUser) {
            return AuditLogDAO.createUserLoginAuditLog(currentSessionOrg, orgUser.userId);
        })
        .then(function(auditSuccess) {
            // Whether it succeeds or not we go ahead and move along.
            var redirectTo = req.session.returnTo === undefined ? '/' : req.session.returnTo;
            res.redirect(redirectTo);
        })
        .catch(function(error) {
            console.log('Error, unable to process callback: '+error.message);
            console.log(error.stack);
            res.redirect('/login#failure');
        })
    });



module.exports = router;