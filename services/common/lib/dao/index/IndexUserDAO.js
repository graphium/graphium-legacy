var _ = require('lodash');
var moment = require('moment');
var indexModels = require('../../model/IndexModels.js');
var crypto = require('crypto');
var sequelize = require('sequelize');

/*
    public String encode(String messageToEncode) {
        try {
            final byte[] secretKey = decodeHex(getEncryptionKey());
            final byte[] initVector = decodeHex(getInitVector());
            final Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(secretKey, "AES"),
                    new IvParameterSpec(initVector, 0, cipher.getBlockSize()));
            byte[] bytesToEncode = messageToEncode.getBytes("UTF-8");
            final byte[] encodedBytes = cipher.doFinal(bytesToEncode);
            return Base64.encodeBase64String(encodedBytes);
        }
        catch(Exception ex) {
            ex.printStackTrace();
            return null;
        }
    }

    public String decode(String messageToDecode) {
        try {
            final byte[] secretKey = decodeHex(getEncryptionKey());
            final byte[] initVector = decodeHex(getInitVector());
            final Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE,
                    new SecretKeySpec(secretKey, "AES"),
                    new IvParameterSpec(initVector, 0, cipher.getBlockSize()));
            byte[] bytesToDecode = Base64.decodeBase64(messageToDecode);
            final byte[] decodedBytes = cipher.doFinal(bytesToDecode);
            return new String(decodedBytes, "UTF-8");
        }
        catch(Exception ex) {
            ex.printStackTrace();
            return null;
        }
    }
 */

/*
    //var cipher = crypto.createCipheriv('aes-256-cbc', keyBytes, ivBytes);
    var text = 'Clipher Message'
    , crypted = cipher.update(text, 'utf-8', 'hex');

    crypted += cipher.final('hex');

    // encrypted
    console.log(crypted);
*/
    

function decryptPassword(base64Password) {
 
    var keyBytes = new Buffer(process.env.PW_KEY, 'hex');
    var ivBytes = new Buffer(process.env.PW_IV, 'hex');    
    var decipher = crypto.createDecipheriv('aes-256-cbc', keyBytes, ivBytes);
    decipher.setAutoPadding(true);
    
    var decrypted = decipher.update(new Buffer(base64Password, 'base64'), 'binary', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

function getAllIndexUsers() {
    return indexModels.getModels().IndexUser.findAll({
        include: [
            { model:indexModels.getModels().Organization, as: 'organizations', where: { activeIndicator: true }, through: {attributes: [], where: { 'actv_ind': true }} }
        ]
    })
    .then(function(result) {
        return _.map(result, function(r) { return r.toJSON() });
    })
}

function getIndexUser(usernameOrEmail) {
    if( !usernameOrEmail )
        throw new Error('Missing parameter usernameOrEmail');

    return indexModels.getModels().IndexUser.findOne({
        where: { userName: usernameOrEmail },
        include: [
            { model:indexModels.getModels().Organization, as: 'organizations', where: { activeIndicator: true }, through: {attributes: [], where: { 'actv_ind': true }} }
        ]
    })
    .then(function(user) {
        if(!user) {
            return indexModels.getModels().IndexUser.findAll({
                where: sequelize.where(sequelize.fn('lower', sequelize.col('email_addr')), sequelize.fn('lower', usernameOrEmail)),
                //where: { emailAddress: usernameOrEmail },
                include: [{ model:indexModels.getModels().Organization, as: 'organizations', where: { activeIndicator: true }, through: {attributes:[], where: { 'actv_ind': true }} }]
            })
        }
        else {
            return Promise.resolve([user]);
        }
    })
    .then(function(users) {

        if(!users || users.length == 0) 
            throw new Error('User not found.');

        if(users.length > 1) {
            throw new Error('Found mulitple users with that email address, unable to authenticate user.');
        }

        if(!users[0].activeIndicator) {
            throw new Error('User account deactivated.');
        }

        var u = users[0].toJSON();
        return Promise.resolve({
            userId: u.userId,
            userName: u.userName,
            firstName: u.firstName,
            lastName: u.lastName,
            emailAddress: u.emailAddress,
            activeIndicator: u.activeIndicator,
            createTime: u.createTime,
            updateTime: u.updateTime,
            auditVersion: u.auditVersion,
            organizations: u.organizations
        });
    });
}

function authenticateIndexUser(usernameOrEmail, password) {

    if( !usernameOrEmail )
        throw new Error('Missing parameter usernameOrEmail');
    if( !password )
        throw new Error('Missing parameter password');
    
    return indexModels.getModels().IndexUser.findOne({
        where: { userName: usernameOrEmail },
        include: [
            { model:indexModels.getModels().Organization, as: 'organizations', where: { activeIndicator: true }, through: {attributes: [], where: { 'actv_ind': true }} }
        ]
    })
    .then(function(user) {
        if(!user) {
            return indexModels.getModels().IndexUser.findAll({
                where: sequelize.where(sequelize.fn('lower', sequelize.col('email_addr')), sequelize.fn('lower', usernameOrEmail)),
                //where: { emailAddress: usernameOrEmail },
                include: [{ model:indexModels.getModels().Organization, as: 'organizations', where: { activeIndicator: true }, through: {attributes:[], where: { 'actv_ind': true }} }]
            })
        }
        else {
            return Promise.resolve([user]);
        }
    })
    .then(function(users) {
        
        if(!users) 
            throw new Error('User not found.');

        if(users.length > 1) {
            throw new Error('Found mulitple users with that email address, unable to authenticate user.');
        }

        if(!users[0].activeIndicator) {
            throw new Error('User account deactivated.');
        }

        var decryptedPassword = decryptPassword(users[0].password);
        if(decryptedPassword != password)
            throw new Error('Invalid username/password.');

        var u = users[0].toJSON();
        return Promise.resolve({
            userId: u.userId,
            userName: u.userName,
            firstName: u.firstName,
            lastName: u.lastName,
            emailAddress: u.emailAddress,
            activeIndicator: u.activeIndicator,
            createTime: u.createTime,
            updateTime: u.updateTime,
            auditVersion: u.auditVersion,
            organizations: u.organizations
        });
    });
}

module.exports = {
    getIndexUser: getIndexUser,
    getAllIndexUsers: getAllIndexUsers,
    authenticateIndexUser: authenticateIndexUser
}