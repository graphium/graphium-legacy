var packageJson = require('./package.json');
//import dotenv = require('dotenv');
//dotenv.load();

// Setup logging
var winston = require('winston');
require('winston-loggly');

import express = require('express');
import path = require('path');
import favicon = require('serve-favicon');
import logger = require('morgan');
import cookieParser = require('cookie-parser');
import helmet = require('helmet');
import bodyParser = require('body-parser');
import xmlParser = require('express-xml-bodyparser');
import session = require('express-session');
var passport = require('passport');
import ConnectRedis = require('connect-redis');
import Redis from 'ioredis';
let RedisStore = ConnectRedis(session);
import enforce = require('express-sslify');
//var FileStore = require('session-file-store')(session);
var flash = require('connect-flash');
import Auth0Strategy = require('passport-auth0');
import * as _ from 'lodash';
import { EnvironmentConfig } from '@common/lib/config/EnvironmentConfig';

let app:any;

async function main() {
    console.log('loading environment config ...');
    await EnvironmentConfig.loadConfig(['general','auth0','org-db','index-db','cache'],process.env.GRAPHIUM_ENV); //process.env.FLOW_ENV);
    console.log('config loaded.');

    // This will configure Passport to use Auth0
    var strategy = new Auth0Strategy({
        domain: EnvironmentConfig.getProperty('auth0','AUTH0_DOMAIN'),
        clientID: EnvironmentConfig.getProperty('auth0','AUTH0_CLIENT_ID'),
        clientSecret: EnvironmentConfig.getProperty('auth0','AUTH0_CLIENT_SECRET'),
        callbackURL: '/callback'
    }, function(accessToken, refreshToken, extraParams, profile, done) {
        // accessToken is the token to call Auth0 API (not needed in the most cases)
        // extraParams.id_token has the JSON Web Token
        // profile has all the information from the user
        return done(null, profile);
    });


    winston.add(winston.transports.Loggly, {
        token: EnvironmentConfig.getProperty('general','LOGGLY_TOKEN'),
        subdomain: "graphium",
        tags: ["app.dashboard","env."+process.env.FLOW_ENV],
        json:true
    });

    app = express();

    // view engine setup
    app.set('views', path.join(__dirname, 'lib', 'views'));
    app.set('view engine', 'jade');

    // uncomment after placing your favicon in /public
    app.use(helmet({
        frameguard: false
    }));
    app.use(favicon(path.join(__dirname, 'public', 'favicon_new.ico')));

    // Enforces SSL and redirects unless it is the ELB hitting 
    // the health check URL.
    let enforceSsl = enforce.HTTPS({ trustProtoHeader: true});
    app.use(function(req, res, next) {
        if(req.originalUrl != '/ping' && req.originalUrl != '/healthcheck') {
            //console.log('Enforcing url.');
            enforceSsl(req, res, next);
        }
        else {
            //console.log('Not enforcing SSL.');
            next();
        }
    });

    app.use(logger('dev'));
    app.use(bodyParser.json({
        limit: 1000000 * 50
    }));
    app.use(xmlParser())
    app.use(bodyParser.urlencoded({
        extended: false,
        limit: 1000000 * 50
    }));
    app.use(cookieParser());
    app.use(session({
        store: new RedisStore({
            client: new Redis({
                tls: {},
                host: EnvironmentConfig.getProperty('cache','CACHE_REDIS_HOST'),
                port: parseInt(EnvironmentConfig.getProperty('cache','CACHE_REDIS_PORT')),
                password: EnvironmentConfig.getProperty('cache','CACHE_REDIS_PASS'),
                keyPrefix: EnvironmentConfig.getProperty('cache','CACHE_SESSION_PREFIX'),
                autoResendUnfulfilledCommands: true,
            }),
            ttl: 43200,
            logErrors: true
        }),
        secret: EnvironmentConfig.getProperty('cache','COLLECTOR_CLIENT_SESSION_SECRET'),
        resave: true,
        saveUninitialized: true
    }));

    passport.use(strategy);

    // you can use this section to keep a smaller payload
    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    passport.deserializeUser(function(user, done) {
        done(null, user);
    });

    app.use(passport.initialize());
    app.use(passport.session());
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(flash());
    app.use(function(req, res, next) {
        res.locals.errorMessages = req["flash"]('error');
        res.locals.successMessages = req["flash"]('success');

        res.locals.redirectWithError = function(error, redirectTo) {

            var errorMessage = 'Unable to complete request. Unknown error.';
            var errorStack;

            if(_.isError(error)) {
                errorMessage = error.message;
                errorStack = error.stack; 
            }
            else if(_.isString(error)) {
                errorMessage = error;
            }

            console.error(errorMessage);
            if(errorStack) console.error(errorStack);

            req["flash"]('error',errorMessage);
            res.redirect(req.get('Referrer') || redirectTo || '/');
        };
        
        res.locals.redirectWithSuccess = function(message, redirectTo) {
            req["flash"]('success',message);
            res.redirect(req.get('Referrer') || redirectTo || '/');
        };

        next();
    });

    let routes = require('./lib/routes/index');
    let user = require('./lib/routes/user');
    let collector = require('./lib/routes/collector');
    let collectorServices = require('./lib/routes/collector.rest');
    let dashboardRoutes = require('./lib/routes/dashboards').dashboardRoutes;
    let dashboardServices = require('./lib/routes/dashboards.rest').dashboardServices;
    let orgSettingsFlow = require('./lib/routes/org.settings.flow');
    let orgSettingsFtp = require('./lib/routes/org.settings.ftp');
    let orgSettingsCollector = require('./lib/routes/org.settings.collector');
    let facilityServices = require('./lib/routes/facility.rest').default;

    app.use('/', routes);
    app.use('/user', user);
    app.use('/collector', collector);
    app.use('/collector', collectorServices);
    app.use('/dashboards', dashboardRoutes);
    app.use('/dashboards', dashboardServices);
    app.use('/org/settings/flow', orgSettingsFlow);
    app.use('/org/settings/ftp', orgSettingsFtp);
    app.use('/org/settings/collector', orgSettingsCollector);
    app.use('/facilities', facilityServices);

    // catch 404 and forward to error handler
    app.use(function(req, res, next) {
        var err = new Error('Not Found');
        err["status"] = 404;
        next(err);
    });

    // setup locals for req/res for use in jade templates.

    let moment = require('moment');
    require('moment-range');

    app.locals.moment = moment;
    app.locals['_'] = _;
    app.locals.helpers = require('./lib/util/templateHelpers.js');
    app.locals.version = packageJson.version;

    // error handlers

    // development error handler
    // will print stacktrace
    if (app.get('env') === 'development') {

        //console.log('Including source map support.');
        require('source-map-support').install();

        app.use(function(err, req, res, next) {
            if(req.route && _.endsWith(req.route.path,'.json')) {
                next();
                return;
            }

            //res.status(err.status || 500);
            res.render('error', {
                message: err.message,
                error: err
            });

        });
    }

    // production error handler
    // no stacktraces leaked to user
    app.use(function(err, req, res, next) {
        if(req.route && _.endsWith(req.route.path,'.json')) {
        next();
        return;
        }
        console.log('====== ERROR: ' + err.message);

        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: {}
        });
    });

    app.set('port', process.env.COLLECTOR_CLIENT_EXPRESS_PORT || process.env.PORT || 8081);
    app.listen(app.get('port'), function() {
        console.log("Starting collector-client on port: " + app.get('port'));
    });
}

main().then(() => {
    console.log('application started.');
})
.catch((error) => {
    console.log('Unable to start application: ' + error.message);
    console.log(error.stack);
})