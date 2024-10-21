var gulp = require("gulp");
var sass = require('gulp-sass');
var server = require('gulp-develop-server');
var del = require('del');
var path = require('path');
var _ = require('lodash');

var serviceName = "collector-client";
var outDirName = 'dist';

var libGulp = require('../common/lib-gulp/');
var servicePath = libGulp.getServicePath(serviceName);
var serviceDistPath = libGulp.getServiceResourcePath(serviceName, outDirName);
var appDistPath = path.join(serviceDistPath,serviceName); // This is becasue the typescript compiler will compile collect-client into a sub folder in dist.
var tsConfigPath = libGulp.getServiceResourcePath(serviceName,'tsconfig.json');

var commonTsConfig = require(libGulp.getServiceResourcePath('common','tsconfig.json'));
var tsConfig = require(tsConfigPath);

var publicAssetsGlob = [servicePath,'public','**/*'].join(path.sep);
var jadeFilesGlob = [servicePath,'lib','**/*.jade'].join(path.sep);
var packageJsonPath = libGulp.getServiceResourcePath(serviceName, 'package.json');
var ebExtensionsGlob = libGulp.getServiceResourcePath(serviceName, '.ebextensions/**/*');
var scssGlob = libGulp.getServiceResourcePath(serviceName, path.join('public','css','*.scss'));

gulp.task('clean:dist', function() { return del(serviceDistPath); });
gulp.task("compile:static", libGulp.tasks.copyStaticFilesToOutput(serviceName, [publicAssetsGlob, jadeFilesGlob, packageJsonPath, ebExtensionsGlob], appDistPath));
gulp.task('compile:env', libGulp.tasks.copyConfig(appDistPath));
gulp.task('compile:common', libGulp.tasks.compileTypescriptService('common', path.join(appDistPath)));
gulp.task('compile:script', libGulp.tasks.compileTypescriptService(serviceName, serviceDistPath));

gulp.task('compile:css', function () {
    return gulp.src(scssGlob)
        .pipe(sass.sync().on('error', sass.logError))
        .pipe(gulp.dest(path.join(appDistPath, 'public', 'css')));
});

gulp.task('compile:watch:script', function(done) {
    var scriptPaths = _.map(tsConfig.include, function(includePath) { return libGulp.getServiceResourcePath(serviceName, includePath); });
    //var globsToWatch = _.flatten([scriptPaths, publicAssetsGlob, jadeFilesGlob, packageJsonPath, ebExtensionsGlob]);
    gulp.watch( scriptPaths, gulp.series(['compile:script']) );
});

gulp.task('compile:watch:common', function(done) {
    var scriptPaths = _.map(commonTsConfig.include, function(includePath) { return libGulp.getServiceResourcePath('common', includePath); });
    gulp.watch( scriptPaths, gulp.series(['compile:common']) );
});

gulp.task('compile:watch:static', function(done) {
    var globsToWatch = _.flatten([publicAssetsGlob, jadeFilesGlob, packageJsonPath, ebExtensionsGlob]);
    gulp.watch( globsToWatch, gulp.series(['compile:static']) );
});

var compile =  gulp.series(['clean:dist','compile:common','compile:env','compile:css','compile:static','compile:script']);
gulp.task('compile', compile);

var develop = gulp.series(['clean:dist','compile', gulp.parallel(['compile:watch:common','compile:watch:script','compile:watch:static'])]);
gulp.task('develop', develop);

module.exports = {
    compile: compile,
    develop: develop
};