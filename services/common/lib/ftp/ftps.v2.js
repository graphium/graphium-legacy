var FTPClient = require('ftp');

var connect = function(ftpConfig) {

    return new Promise(function(resolve,reject) {
        console.log('Creating FTP client...');
        console.log(ftpConfig);
        var resolved = false;
        var c = new FTPClient();
        
        c.on('ready', function() {
            console.log('Connected to FTP.');
            resolved = true;
            resolve(c); 
        });
        c.on('error', function(error) {
            console.log('Error connecting to FTP client...');
            if(!resolved) {
                console.log('Error, unable to create FTP client: ' + error.message);
                reject(error);
            }    
        })
        
        var config = {
            host: ftpConfig.host,
            port: ftpConfig.port,
            secure: true,
            user: ftpConfig.username,
            password: ftpConfig.password,
            secureOptions: {
                rejectUnauthorized: true
            }
        };
        console.log('Connecting to FTP(SSL): ');
        console.log(config);
        c.connect(config);
    });
}

var createDirectory = function(ftpConfig, path) {
    return connect(ftpConfig)
    .then(function(ftpClient) {

    })
}

var listDirectories = function(ftpConfig, path) {
    return connect(ftpConfig)
    .then(function(ftpClient) {
        ftpClient.list(path, function(err, list) {
            if(err)
                return Promise.reject(err);

            var directories = _.map(list, function(object) {
                if(object.type == 'd')
                    return object;
                else
                    return undefined;
            });
            return Promise.resolve(directories);
        });
    })
}

var listFiles = function(ftpConfig, path, callback) {
    console.log('Listing FTPS files...');
    return connect(ftpConfig)
    .then(function(ftpClient) {
        ftpClient.list(path, function(err, list) {
            if(err)
                return Promise.reject(err);

            var directories = _.map(list, function(object) {
                if(object.type != 'd')
                    return object;
                else
                    return undefined;
            });
            return Promise.resolve(directories);
        });
    })
}

var getFileData = function( ftpConfig, path, callback) {
    return connect(ftpConfig)
    .then(function(ftpClient) {
        
    })
}

var createTextFile = function( ftpConfig, path, text, callback) {
    return connect(ftpConfig)
    .then(function(ftpClient) {
        
    })
}

module.exports = {
    connect: connect,
    listDirectories: listDirectories,
    listFiles: listFiles,
    getFileData: getFileData,
    createTextFile: createTextFile,
    createDirectory: createDirectory
}