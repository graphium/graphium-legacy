var Client = require('ssh2').Client;

var algorithms = {
    kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384','ecdh-sha2-nistp521','diffie-hellman-group-exchange-sha256','diffie-hellman-group14-sha1','diffie-hellman-group-exchange-sha1','diffie-hellman-group1-sha1'],
    cipher: ['aes128-ctr','aes192-ctr','aes256-ctr','aes128-gcm','aes128-gcm@openssh.com','aes256-gcm','aes256-gcm@openssh.com','aes256-cbc','aes192-cbc','aes128-cbc','blowfish-cbc','3des-cbc','arcfour256','arcfour128','cast128-cbc','arcfour'],
    serverHostKey: ['ssh-rsa','ssh-dss'], // NODE 5.2.0+ 'ecdsa-sha2-nistp256','ecdsa-sha2-nistp384','ecdsa-sha2-nistp521'
    hmac: ['hmac-sha2-256','hmac-sha2-512','hmac-sha1','hmac-md5','hmac-sha2-256-96','hmac-sha2-512-96','hmac-ripemd160','hmac-sha1-96','hmac-md5-96']
};

var connectToSFTP = function(ftpConfig, callback) {
    try {
        var conn = new Client();
        conn.on('ready', function() {
        conn.sftp(function(err, sftp) {
            if (err) {
                callback('[ERROR] Unable to connect to SFTP site: ' + err);
            }
            else {
                callback(null, sftp, conn);
            }
        });
        }).connect({
            //debug: function(s) { console.log(new Date().toTimeString() + ' ' + s); },
            host: ftpConfig.host,
            port: ftpConfig.port,
            username: ftpConfig.username,
            password: ftpConfig.password,
            algorithms: algorithms,
            readyTimeout: 60000,
        });
    }
    catch(error) {
        console.log('connectToSftpError: '+error.message);
        callback(error);
    }
}

var createDirectory = function(ftpConfig, path, callback) {
    var conn = new Client();
    console.log('Attempting to connect to sftp to mkdir.');
    conn.on('ready', function() {
    conn.sftp(function(err, sftp) {
        console.log('Connected to sftp.');
        
        if (err) {
            callback('[ERROR] Unable to connect to SFTP site: ' + err);
        }
        else {
            console.log('sftp.mkdir: ' + sftp.mkdir);
            sftp.mkdir(path, function(err) {
            conn.end();
            if (err) {
                //console.log("Unable to read root directory.");
                callback('[ERROR] Unable to create directory: ' + err);
            }
            else {
                callback();
            }
            });
        }
    });
    }).connect({
        host: ftpConfig.host,
        port: ftpConfig.port,
        username: ftpConfig.username,
        password: ftpConfig.password,
        //debug: function(s) { console.log(new Date().toTimeString() + ' ' + s); },
        algorithms: algorithms
    });
}

var listFtpDirectories = function(ftpConfig, callback) {
    var conn = new Client();
    conn.on('ready', function() {
    conn.sftp(function(err, sftp) {
        if (err) {
            callback('[ERROR] Unable to connect to SFTP site: ' + err);
        }
        else {
            sftp.readdir('.', function(err, list) {
            conn.end();
            if (err) {
                //console.log("Unable to read root directory.");
                callback('[ERROR] Unable to read root directory: ' + err);
            }
            else {
                //console.log("Retrievved directory list.");
                var dirs = [];
                for( var i = 0; i < list.length; i++ ) {
                    if( list[i].attrs.isDirectory() )
                        dirs.push(list[i]);
                }
                callback(null, dirs);
            }
            });
        }
    });
    }).connect({
        host: ftpConfig.host,
        port: ftpConfig.port,
        username: ftpConfig.username,
        password: ftpConfig.password,
        algorithms: algorithms
    });
}

var listFTPFiles = function(ftpConfig, path, callback) {
    var conn = new Client();
    conn.on('ready', function() {
    conn.sftp(function(err, sftp) {
        if (err) {
            callback('[ERROR] Unable to connect to SFTP site: ' + err);
        }
        else {

                sftp.readdir( path, function(err, list) {
                    conn.end();
                    if (err) {
                        //console.log("Unable to view directory.");
                        callback('[ERROR] Unable view directory: ' + err);
                    }
                    else {
                        //console.log("Retrieved directory list.");
                        callback(null, list);
                    }
                });
        }
    });
    }).connect({
        host: ftpConfig.host,
        port: ftpConfig.port,
        username: ftpConfig.username,
        password: ftpConfig.password,
        algorithms: algorithms
    });
}

var getFTPFileData = function( ftpConfig, path, callback) {
    connectToSFTP(ftpConfig, function(error, sftp, conn) {
        var stream = sftp.createReadStream(path, {encoding:'utf8'});
        var data = '';
        stream.on('data', function(chunk) {
            data += chunk;
        });
        stream.on('end', function() {
        });
        stream.on('error', function(error) {
            //console.log('Unable to read file from SFTP: ' + error);
            conn.end();
            callback(error);
        });
        stream.on('close', function() {
            //console.log('Closed read stream from sftp.');
            conn.end();
            callback(null, data);
        });
    });
}

var createFtpTextFile = function( ftpConfig, path, text, callback) {

    connectToSFTP(ftpConfig, function(error, sftp, conn) {
        if(error) {
            callback(error);
            return;
        }
        
        var stream = sftp.createWriteStream(path, {encoding:'utf8'});
        stream.on('close', function() {
//            console.log('writeStream.close: ');
            sftp.end();
            conn.end();
            callback(null);
        });
        stream.on('write', function() {
//            console.log('writeStream.write');
        });
        stream.on('error', function(error) {
//            console.log('writeStream.error: ' + error);
            sftp.end();
            conn.end();
            callback(error);
        });
        stream.end(text);
    });
}

module.exports = {
    connectToSFTP: connectToSFTP,
    listFtpDirectories: listFtpDirectories,
    listFTPFiles: listFTPFiles,
    getFTPFileData: getFTPFileData,
    createFtpTextFile: createFtpTextFile,
    createDirectory: createDirectory
}