var path = require('path');
var gulp = require('gulp');
var filter = require('gulp-filter');
var tap = require('gulp-tap');
var ts = require("gulp-typescript");
var rename = require('gulp-rename');
var del = require('del');
var url = require('url');
var AWS = require('aws-sdk');
var spawn = require('child_process').spawn;
var _ = require('lodash');
var gutil = require('gulp-util');
var fs = require('fs');

var getConfigForEnv = function() {
    var configPath = path.join(projectRoot,'services','config');
    switch(process.env.NODE_ENV) {
        case "production": return configPath+path.sep+"pro.env";
        case "staging": return configPath+path.sep+"pro.env";
        case "development": return configPath+path.sep+"dev.env";
        case "local": return configPath+path.sep+"local.env";
        case "development-pro": return configPath+path.sep+"local-pro.env";
        case "test": return configPath+path.sep+"test.env";
        default: throw new Error('Unable to determine environment (' + process.env.NODE_ENV + ') for config loading.');
    }
}

var executeCommand = function(command, args, options, callback) {  
    //console.log("Executing command '" + _.concat([command],args).join(' '));
    const ctx = spawn(command, args, options);
    ctx.stdout.on('data', function(data) {
        process.stdout.write(data);
    });
    ctx.stderr.on('data', function(data) {
        process.stderr.write(data);
    });
    ctx.on('close', function(code) {
        if(callback) { 
            callback(code === 0 ? null : new Error('Command ' + command + ' failed with code: ' + code));
        }
    })
}

var getAwsEcrAuthorizationToken = function(callback) {
    console.log('Region: ' + "us-east-1");
    var ecr = new AWS.ECR({ region: "us-east-1" });
    ecr.getAuthorizationToken({}, function(err, data) {
        if (err) {
            callback(new Error(err.message));
        }
        else {
            callback(null, data);
        }
    });
}

var loginFromEcrToken = function(path, tokenData, callback) {
    var authData = tokenData.authorizationData[0];
    var repoPassword = new Buffer(authData.authorizationToken, 'base64').toString('utf8').substr(4);
    executeCommand('docker', ['login','-u','AWS','-p',repoPassword,authData.proxyEndpoint],{cwd:path},callback);
}

var getRepositoryHostFromAuthToken = function(tokenData) {
    var authData = tokenData.authorizationData[0];
    var proxyUrl = url.parse(authData.proxyEndpoint);
    return proxyUrl.host;
}

var pushDockerImage = function(path, image, callback) {
    executeCommand('docker', ['push', image], {cwd:path}, callback);
}

var tagDockerImage = function(path, sourceImage, targetImage, callback) {
    executeCommand('docker', ['tag', sourceImage, targetImage], {cwd:path}, callback);
}

var buildDockerImage = function(path, tags, targetPlatform, callback) {
    var cmdArgs = ['buildx','build','--platform',targetPlatform];
    tags.forEach(function(tag) {
        cmdArgs.push('-t',tag);
    });
    cmdArgs.push('.');
    console.log('Executing docker build image with: ' + cmdArgs.join(' '));
    executeCommand('docker',cmdArgs, {cwd:path}, callback);
}

var getEnvironmentShortName = function() {
    switch(process.env.NODE_ENV) {
        case "production": return "pro";
        case "staging": return "stage";
        case "development": return "local";
        case "development-pro": return "local-pro";
        case "test": return "test";
        default: throw new Error('Unable to determine environment (' + process.env.NODE_ENV + ') for config loading.');
    }
}

var projectRoot = path.join(__dirname,'..','..','..');

var getResourcePath = function(resource) {
    return path.join(projectRoot,resource);
}

var getServicePath = function(serviceName) {
    return path.join(projectRoot,'services',serviceName)
}

var getServiceResourcePath = function(serviceName, resource) {
    return path.join(getServicePath(serviceName), resource);
}

var getServiceDistVersion = function(config) {
    console.log("__dirname" + __dirname);
    console.log("Project root: " + projectRoot);
    var serviceDistPath = path.join(projectRoot,'dist',config.name);
    return require(path.join(serviceDistPath,'package.json')).version;
}

var tsProjectMapping = {};

var getTypescriptProjectByServiceName = function(serviceName) {
    if(!tsProjectMapping[serviceName]) {
        var tsConfigPath = [getServicePath(serviceName),'tsconfig.json'].join(path.sep);
        tsProjectMapping[serviceName] = ts.createProject(tsConfigPath);
    }
    return tsProjectMapping[serviceName];
}

var deployLambdaFunction = function(config) {
    var serviceName = config.name;

    return function(done) {

        var serviceDistPath = path.join(projectRoot,'dist',serviceName);
        var version = getServiceDistVersion(config);
        var archivePath = path.join(projectRoot,'dist',[serviceName,version,getEnvironmentShortName(),'zip'].join('.'));

        AWS.config.region = 'us-east-1';
        var lambda = new AWS.Lambda({
            httpOptions: {
                timeout: 60 * 10 * 1000 // 10 minutes
            }
        });
        var functionName = serviceName + '-' + getEnvironmentShortName();
        if(config.hasOwnProperty('functionName') && config.functionName.hasOwnProperty(process.env.NODE_ENV)) {
            functionName = config.functionName[process.env.NODE_ENV];
            console.log('Using user defined function name: ' + functionName);
        }
        
        lambda.getFunction({FunctionName: functionName}, function(err, data) {
            if (err) {
                if (err.statusCode === 404) {
                    var warning = 'Unable to find lambda function ' + functionName + '. '
                    warning += 'Verify the lambda function name and AWS region are correct.'
                    gutil.log(warning);
                } else {
                    var warning = 'AWS API request failed. '
                    warning += 'Check your AWS credentials and permissions.'
                    gutil.log(warning);
                }
                done(err);
                return;
            }
        
            gutil.log('Found function to update.');
            fs.readFile(archivePath, function(err, data) {
                var params = {
                    FunctionName: functionName,
                    ZipFile: data
                };
                gutil.log('Read archive file, preparing to upload to lambda.');
                lambda.updateFunctionCode(params, function(err, data) {
                    if (err) {
                        gutil.log('Code upload failed. Check your iam:PassRole permissions.');
                        done(err);
                    }
                    else {
                        gutil.log('Successfully updated function code, publishing version...');
                        setTimeout(function() {
                            lambda.publishVersion({
                                FunctionName: functionName,
                                Description: version
                            }, function(err, data) {
                                done(err);
                            });
                        }, 45000);
                    }
                });
            });
        });
    };
}

var pushServiceDockerImageTask = function(config) {
    var serviceName = config.name;

    return function(done) {
        var serviceName = config.name;
        var serviceDistPath = path.join(projectRoot,'dist',serviceName);
        var serviceVersion = getServiceDistVersion(config);
        var repositoryName = config.ecrRepositoryName[process.env.NODE_ENV];
        var targetPlatform = config.targetPlatform || 'linux/amd64';

        if(!repositoryName) {
            throw new Error('Unable to push docker image, no ecrRepositoryName specified in service config.');
        }
        
        console.log('Retreiving docker repository authorization token from AWS.');
        getAwsEcrAuthorizationToken(function(getTokenError, tokenData) {
            if(getTokenError) { done(getTokenError); return; }


            console.log('Logging into repository.');
            loginFromEcrToken(serviceDistPath, tokenData, function(loginError) {
                if(loginError) { done(loginError); return; }

                console.log('Building docker image for ' + serviceName);
                buildDockerImage(serviceDistPath, [repositoryName], targetPlatform, function(buildImageError) {
                    if(buildImageError) { done(buildImageError); return; }
                    
                    var proxyHost = getRepositoryHostFromAuthToken(tokenData);
                    var sourceImage = repositoryName + ":latest";
                    var targetImage = proxyHost + "/" + repositoryName + ":v"+serviceVersion;
                    var targetImageLatest = proxyHost + "/" + repositoryName + ":latest";
                    console.log('Successfully built image, tagging for push to repository: ' + repositoryName + ':latest => ' +proxyHost+"/"+repositoryName+":v"+serviceVersion);
                    tagDockerImage(serviceDistPath, sourceImage, targetImage, function(tagImageError) {
                        if(tagImageError) { done(tagImageError); return; }

                        console.log('Tagging as latest.');
                        tagDockerImage(serviceDistPath, targetImage, targetImageLatest, function(tagImageLatestError) {
                            if(tagImageLatestError) { done(tagImageLatestError); return; }
                            
                            console.log('Successfully tagged image.');
                            pushDockerImage(serviceDistPath, targetImage, function(pushImageError) {
                                if(pushImageError) { done(pushImageError); return; }

                                console.log('Succesfully pushed image (' + targetImage + ') to repository.');
                                pushDockerImage(serviceDistPath, targetImageLatest, function(pushLatestImageError) {
                                    if(pushLatestImageError) { done(pushLatestImageError); return; }

                                    console.log('Succesfully pushed image (' + targetImageLatest + ') to repository.');
                                    done();
                                });
                            })
                        });
                    });

                });
            });

        });

    }
}

var copyStaticFilesToOutput = function(serviceName, files, outDir) {
    var servicePath = getServicePath(serviceName);
    return function() {
        console.log('[' + serviceName + '] Copying static files from ' + servicePath + ' : ' + files + ' => ' + outDir);
        return gulp.src(files,{base:servicePath, allowEmpty: true})
        .pipe(gulp.dest(outDir));
    };
}

var indicateTypescriptCompilerStart = function(serviceName) {
    return function(done) {
        console.log('[' + serviceName + '] Compile start...');
        done();
    }
}

var indicateTypescriptCompilerStop = function(serviceName) {
    return function(done) {
        console.log('[' + serviceName + '] Compile complete.');
        done();
    }
}

var compileTypescriptService = function(serviceName, outDir) {
    var filterGlobs = ['!*'];
    if(serviceName != 'common') {
        filterGlobs = [serviceName];
    }

    var task = function() {
        var tsProject = getTypescriptProjectByServiceName(serviceName);
        return tsProject.src()
        .pipe(tsProject())
        .pipe(gulp.dest(outDir));
    }
    return gulp.series([indicateTypescriptCompilerStart(serviceName), task, indicateTypescriptCompilerStop(serviceName)])
}

var cleanDirectory = function(dir) {
    return function() {
        console.log('Cleaning directory: ' + dir);
        return del(dir);
    };
}

/*
var compile =  gulp.series(['clean:dist','compile:common','compile:env','compile:static','compile:script']);
gulp.task('compile', compile);

var develop = gulp.series(['clean:dist','compile', gulp.parallel(['compile:watch:common','compile:watch:script'])]);
gulp.task('develop', develop);
*/

var compileService = function(serviceConfig, includeCommon) {
    if(serviceConfig.type == "beanstalk") {
        return compileBeanstalkService(serviceConfig, includeCommon);
    }
    else if(serviceConfig.type == "lambda") {
        return compileBeanstalkService(serviceConfig, includeCommon);
    }
    else if(serviceConfig.type == "custom") {
        var gulpTasks = require(getServiceResourcePath(serviceConfig.name, "gulpfile.js"));
        return gulpTasks.compile;
    }
    throw new Error('Unknown build type, unable to generate compile task for: ' + serviceConfig.name);
}

var compileBeanstalkService = function(serviceConfig, includeCommon) {
    var serviceName = serviceConfig.name;
    var scriptIncludes = serviceConfig.scriptIncludes || ["server.js","server.ts","index.js","index.ts","lib/**/*.js","lib/**/*.ts"];
    var staticIncludes = serviceConfig.staticIncludes || ["package.json","package-lock.json",".ebextensions/**/*"];
    
    var distDir = getServiceResourcePath(serviceName, serviceConfig.distDir || "dist");
    var appDistDir = path.join(distDir, serviceName);

    var tasks = [];

    //tasks.push(cleanDirectory(distDir));
    //tasks.push(copyConfig(appDistDir));
    //tasks.push(compileTypescriptService(serviceName, distDir));
    //if(includeCommon !== false || serviceConfig.includeCommon !== false)
    //    tasks.push(compileTypescriptService('common', appDistDir));

    return gulp.series(tasks);
}

var getServiceArtifactFileName = function(serviceConfig, version) {
    return serviceConfig.name + '.' + version + '.' + getEnvironmentShortName() + '.zip'
}

var deployArtifact = function() {    
    var version = require(getServiceResourcePath(serviceConfig.name, "package.json")).version;
    return gulp.src('./' + getArtifactFileName(version,argv.env))
    .pipe(s3({
                Bucket: 'flow.artifacts',
                ACL: 'bucket-owner-full-control',
                keyTransform: function(relativeFilename) {
                    return getArtifactFileName(version,argv.env);
                }
            }));
};

var deployBeanstalk = function(serviceConfig, done) {
    var version = require('./package.json').version;
    var beanstalk = new AWS.ElasticBeanstalk({region:"us-east-1"});
    var params = {
        ApplicationName: serviceConfig.name,
        VersionLabel: version + '.' + argv.env,
        AutoCreateApplication: false,
        SourceBundle: {
            S3Bucket: 'flow.artifacts',
            S3Key: getArtifactFileName(version,argv.env)   
        }
    };
    beanstalk.createApplicationVersion(params, function(err, data) {
        if (err) {
            //guril.log(err, err.stack); 
            done(err); // an error occurred  
        } 
        else {
            gutil.log('Successfully uploaded application version: ' + data.ApplicationVersion.VersionLabel); 
            var updateEnvParams = {
                EnvironmentName: serviceName + '-' + argv.env,
                VersionLabel: data.ApplicationVersion.VersionLabel
            };
            
            beanstalk.updateEnvironment(updateEnvParams, function(err, data) {
                if (err) {
                    gutil.log('Unable to deploy application version to environment: ' + err.message);
                    done(err);
                }
                else {
                    gutil.log('Successfully initiated deployment of application version.');
                    done();
                }
            });
        }
    });
};

var getBeanstalkStagingEnvironmentFromDns = function(config, callback) {

    if(!config.blueGreenDeployment) {
        if(config.environment && _.isString(config.environment[process.env.NODE_ENV])) {
            callback(null, config.environment[process.env.NODE_ENV]);
        }
        else {
            callback(null, (config.applicationName || config.name) + '-' + getEnvironmentShortName());
        }
    }
    else {
        var releaseResource = config.url.production.release;

        var route53 = new AWS.Route53();
        var beanstalk = new AWS.ElasticBeanstalk({region:"us-east-1"});
        var environment = config.environment[process.env.NODE_ENV];

        route53.listHostedZones({}, function(err, data) {
            var zone = data.HostedZones.find((zone) => zone.Name == config.url.zoneName);
            console.log('Found zone for service: ' + zone.Id);
            
            route53.listResourceRecordSets( { HostedZoneId: zone.Id }, (error, listResourceRecordSetsResponse) => {
                let releaseZoneResource = listResourceRecordSetsResponse.ResourceRecordSets.find((resource) => resource.Name == config.url.production.release);
                console.log('Current DNS for release environment: ' + releaseZoneResource.ResourceRecords[0].Value);
                console.log('Retrieving environment information for applicaiton: ' + config.applicationName);
                beanstalk.describeEnvironments({ ApplicationName: config.applicationName, IncludeDeleted: false }, function(err, describeEnvironmentsResponse) {
                    if(err) {
                        console.log(err.message);
                        callback(err);
                        return;
                    }

                    var blueEnvironment = describeEnvironmentsResponse.Environments.find((env) => env.EnvironmentName == environment.blue);
                    var greenEnvironment = describeEnvironmentsResponse.Environments.find((env) => env.EnvironmentName == environment.green);
                    console.log("Blue environment CNAME: " + blueEnvironment.CNAME);
                    console.log("Green environment CNAME: " + greenEnvironment.CNAME);

                    if(releaseZoneResource.ResourceRecords.find((record) => record.Value == blueEnvironment.CNAME)) {
                        console.log('Release zone is currently set to blue environment, staging is green.');
                        console.log(environment);
                        callback(null, environment.green);
                    }
                    else if(releaseZoneResource.ResourceRecords.find((record) => record.Value == greenEnvironment.CNAME)) {
                        console.log('Release zone is currently set to green environment.');
                        callback(null, environment.blue);
                    }
                    else {
                        callback(new Error('Unable to determine release environment, current DNS does not use either blue or green beanstalk CNAME.'));
                    }
                });
            });
        });
    }

}

var copyConfig = function(outDir) {
    var config = getConfigForEnv();
    return function() {
        return gulp.src(config)
            .pipe(rename('.env'))
            .pipe(gulp.dest(outDir));
    }
}

module.exports = {
    getEnvironmentShortName: getEnvironmentShortName,
    getConfigForEnv: getConfigForEnv,
    getResourcePath: getResourcePath,
    getBeanstalkStagingEnvironmentFromDns: getBeanstalkStagingEnvironmentFromDns,  
    projectRoot: projectRoot,
    getServicePath: getServicePath,
    getServiceResourcePath: getServiceResourcePath,
    getServiceDistVersion: getServiceDistVersion,
    getTypescriptProjectByServiceName: getTypescriptProjectByServiceName,
    tasks: {
        copyStaticFilesToOutput: copyStaticFilesToOutput,
        compileTypescriptService: compileTypescriptService,
        copyConfig: copyConfig,
        compileBeanstalkService: compileBeanstalkService,
        compileService: compileService,
        pushServiceDockerImageTask: pushServiceDockerImageTask,
        deployLambdaFunction: deployLambdaFunction
    }
}