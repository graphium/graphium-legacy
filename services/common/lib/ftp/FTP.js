var ftps = require('./ftps.v2.js');
var sftp = require('./sftp.v2.js');

function FTP(ftpConfig) {
    this.ftpConfig = ftpConfig;

    if(ftpConfig.protocol == 'ftps') {
        this.client = ftps;
    }
    else if(ftpConfig.protocol == 'sftp') {
        this.client = sftp;
    }
    else {
        throw new Error('Unable to create client, unknown FTP protocol: ' + this.ftpConfig.protocol);
    }
}

FTP.prototype.listFiles = function(path) {
    return this.client.listFiles(this.ftpConfig, path);
}

FTP.prototype.getFileData = function(path) {
    console.log('FTP.getFileData');
    return this.client.getFileData(this.ftpConfig, path);
}

module.exports = FTP;