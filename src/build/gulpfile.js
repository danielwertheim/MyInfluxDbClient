var gulp = require('gulp'),
    //debug = require('gulp-debug'),
    merge = require('merge-stream'),
    flatten = require('gulp-flatten'),
    shell = require('gulp-shell'),
    del = require('del'),
    assemblyInfo = require('gulp-dotnet-assembly-info'),
    argv = require('yargs').argv,
    sequence = require('run-sequence');

var ver = '0.6.0',
    config = {
        srcdir: './../',
        projects: ['MyInfluxDbClient'],
        build: {
            outdir: './artifacts/',
            semver: ver, //suffix e.g. 'rc-1'
            version: ver + '.' + (argv && argv.buildrevision ? argv.buildrevision : '0'),
            profile: argv && argv.buildprofile ? argv.buildprofile : 'Release'
        },
        tools: {
            msbuild: '"C:/Program Files (x86)/MSBuild/14.0/Bin/MSBuild.exe"',
            nunit: '"./tools/NUnit.ConsoleRunner.3.2.0/tools/nunit3-console.exe"'
        }
    };

gulp.task('default', function (cb) {
    sequence(
        ['clean','assemblyinfo'],
        'build',
        'unit-tests',
        'copy',
        cb);
});

gulp.task('ci', function (cb) {
    sequence(
        ['init-tools', 'clean', 'assemblyinfo', 'nuget-restore'],
        'build',
        'unit-tests',
        'integration-tests',
        'copy',        
        'nuget-pack',
        cb);
});

gulp.task('init-tools', shell.task('nuget restore ./tools/packages.config -o ./tools/'));

gulp.task('nuget-restore', function () {
    return gulp.src(config.srcdir + '*.sln', { read: false })
        .pipe(shell('nuget restore <%= file.path %>'));
});

gulp.task('clean', function(cb) {
    return del(config.build.outdir);
});

gulp.task('assemblyinfo', function() {
    return gulp.src(config.srcdir + 'GlobalAssemblyInfo.cs')
        .pipe(assemblyInfo({
          version: config.build.version,
          informationalVersion: config.build.semver
        }))
        .pipe(gulp.dest(config.srcdir));
});

gulp.task('build', function() {
    return gulp.src(config.srcdir + '*.sln', { read: false })
        .pipe(shell(config.tools.msbuild + ' <%= file.path %> /v:quiet /t:Clean /t:Rebuild /p:Configuration=' + config.build.profile));
});

gulp.task('copy', function() {
    var tasks = config.projects.map(function (name) {
        return gulp.src(config.srcdir + 'projects/' + name + '/bin/' + config.build.profile + '/*.{dll,XML}')
            .pipe(flatten())
            .pipe(gulp.dest(config.build.outdir + '/' + name));
    });

    return merge(tasks);
});

gulp.task('unit-tests', function () {
    return gulp.src(config.srcdir + 'tests/**/bin/' + config.build.profile + '/*.UnitTests.dll')
        .pipe(shell(config.tools.nunit + ' <%= file.path %> --noresult'));
});

gulp.task('integration-tests', function () {
    return gulp.src(config.srcdir + 'tests/**/bin/' + config.build.profile + '/*.IntegrationTests.dll')
        .pipe(shell(config.tools.nunit + ' <%= file.path %> --noresult'));
});

gulp.task('nuget-pack', function () {
    return gulp.src('*.nuspec', { read: false })
        .pipe(shell('nuget pack <%= file.path %> -version ' + config.build.semver + ' -basepath ' + config.build.outdir + ' -o ' + config.build.outdir));
});
