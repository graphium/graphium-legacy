var Client = require('ssh2').Client;
var _ = require('lodash');

var connect = function(ftpConfig, callback) {
    //console.log('Attempting to connect sftp.');
    try {
        //console.log('Creating SSH2 client...');
        var conn = new Client();
        conn.on('ready', function() {
            //console.log('SSH2 client ready.');
            conn.sftp(function(err, sftp) {
                if (err) {
                    callback('[ERROR] Unable to connect to SFTP site: ' + err);
                }
                else {
                    callback(null, sftp, conn);
                }
            });
        });
        conn.on('error', function(error) {
            callback(error);
        })
        
        var sshConfig = {
            //debug: function(s) { console.log(new Date().toTimeString() + ' ' + s); },
            host: ftpConfig.host,
            port: ftpConfig.port,
            username: ftpConfig.username,
            password: ftpConfig.password,
            algorithms: {
                kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384','ecdh-sha2-nistp521','diffie-hellman-group-exchange-sha256','diffie-hellman-group14-sha1','diffie-hellman-group-exchange-sha1','diffie-hellman-group1-sha1'],
                cipher: ['aes128-ctr','aes192-ctr','aes256-ctr','aes128-gcm','aes128-gcm@openssh.com','aes256-gcm','aes256-gcm@openssh.com','aes256-cbc','aes192-cbc','aes128-cbc','blowfish-cbc','3des-cbc','arcfour256','arcfour128','cast128-cbc','arcfour'],
                serverHostKey: ['ssh-rsa','ssh-dss'], // NODE 5.2.0+ 'ecdsa-sha2-nistp256','ecdsa-sha2-nistp384','ecdsa-sha2-nistp521'
                hmac: ['hmac-sha2-256','hmac-sha2-512','hmac-sha1','hmac-md5','hmac-sha2-256-96','hmac-sha2-512-96','hmac-ripemd160','hmac-sha1-96','hmac-md5-96']
            },
            readyTimeout: 10000
        };

        conn.connect(sshConfig);
    }
    catch(error) {
        //console.log('sftp connect error: '+error.message);
        callback(error);
    }
}

var createDirectory = function(ftpConfig, path) {
    return new Promise(function(resolve, reject) {
        connect(ftpConfig, function(error, sftp, conn) {
            if(error) {
                reject(error);
                return;
            }

            sftp.mkdir(path, function(err) {
                conn.end();
                if (err) {
                    //console.log("Unable to read root directory.");
                    reject(new Error('Unable to create directory: ' + err));
                }
                else {
                    resolve();
                }
            });
        });
    });
}

var listDirectories = function(ftpConfig, path) {
    return new Promise(function(resolve, reject) {
        connect(ftpConfig, function(error, sftp, conn) {
            if(error) {
                reject(error);
                return;
            }

            sftp.readdir( path, function(err, list) {
                conn.end();
                if (err) {
                    //console.log("Unable to view directory.");
                    reject(err);
                }
                else {
                    //console.log("Retrieved directory list.");
                    var dirs = [];
                    for( var i = 0; i < list.length; i++ ) {
                        if( list[i].attrs.isDirectory() )
                            dirs.push(list[i]);
                    }
                    resolve(dirs);
                }
            });
        });
    });
}

var listFiles = function(ftpConfig, path, callback) {
    return new Promise(function(resolve, reject) {
        connect(ftpConfig, function(error, sftp, conn) {
            if(error) {
                reject(error);
                return;
            }

            sftp.readdir( path, function(err, list) {
                conn.end();
                if (err) {
                    reject(err);
                }
                else {
                    var files = _.compact(_.map(list, function(object) {
                        if(object.attrs.isDirectory())
                            return undefined;
                        return {
                            name: object.filename,
                            size: object.attrs.size,
                            modifyTime: object.attrs.mtime ? object.attrs.mtime * 1000 : null
                        };
                    }));
                    resolve(files);
                }
            });
        });
    });
}

var getFileDataOld = function( ftpConfig, path) {
    console.log('sftp.getFileData');
    return new Promise(function(resolve, reject) {
        connect(ftpConfig, function(error, sftp, conn) {
            console.log('Connected to FTP...')
            if(error) {
                console.log('Unable to connect, failing.');
                reject(error);
                return;
            }

            var stream = sftp.createReadStream(path, { encoding: 'binary' });
            var data = [];
            stream.on('data', function(chunk) {
                console.log('Got chunk of FTP File: ' + data.length);
                console.log('Chunk: ' + chunk);
                data.push(chunk);
            });
            stream.on('end', function() {
                console.log('Completed retriving file data...')
            });
            stream.on('error', function(error) {
                console.log('Unable to read file from SFTP: ' + error);
                conn.end();
                reject(error);
            });
            stream.on('close', function() {
                console.log('Closed read stream from sftp.');
                conn.end();
                resolve(data);
            });
            stream.on('finish', function() {
                console.log('[finish] stream');
            })
        });
    });
}


var getFileData = function( ftpConfig, path ) {
    return new Promise(function(resolve, reject) {
        var connection;
        connect(ftpConfig, function(err, sftp, conn) {
            connection = conn;
            if(err) {
                if(connection) {
                    connection.end();
                }
                reject(err);
                return;
            }

            sftp.open(path, "r", function(err, fd) {
                if(err) {
                    if(connection) {
                        connection.end();
                    }
                    reject(err);
                    return;
                }
                
                sftp.fstat(fd, function(err, stats) {
                    if(err) {
                        sftp.close(fd);
                        reject(err);
                        return;
                    }
                    
                    var bufferSize = stats.size,
                        chunkSize = 32768,
                        buffer = new Buffer(bufferSize),
                        currentOffset = 0,
                        errorOccured = false,
                        totalBytesRead = 0;

                    function readNextChunk() {
                        currentOffset = totalBytesRead;
                        if ((currentOffset + chunkSize) > bufferSize) {
                            chunkSize = (bufferSize - currentOffset);
                        }
                        sftp.read(fd, buffer, currentOffset, chunkSize, currentOffset, readCallback);
                    }

                    function readCallback(err, bytesRead, buf, pos) {
                        if(err) {
                            errorOccured = true;
                            sftp.close(fd);
                            reject(err);
                            return;
                        }

                        totalBytesRead += bytesRead;
                        if(totalBytesRead === bufferSize) {
                            resolve(buffer);
                            sftp.close(fd);
                        }
                        else {
                            readNextChunk();
                        }
                    }

                    readNextChunk();
                });
            });
        });
    });
}

var createTextFile = function( ftpConfig, path, text, callback) {
    return new Promise(function(resolve, reject) {
        connect(ftpConfig, function(error, sftp, conn) {
            if(error) {
                reject(error);
                return;
            }
            
            var stream = sftp.createWriteStream(path, {encoding:'utf8'});
            stream.on('close', function() {
                //console.log('writeStream.close');
                sftp.end();
                resolve(null);
            });
            stream.on('error', function(error) {
                //console.log('writeStream.error: ' + error);
                sftp.end();
                reject(error);
            });
            stream.end(text);
        });
    });
}

module.exports = {
    connect: connect,
    listDirectories: listDirectories,
    listFiles: listFiles,
    getFileData: getFileData,
    createTextFile: createTextFile,
    createDirectory: createDirectory
}