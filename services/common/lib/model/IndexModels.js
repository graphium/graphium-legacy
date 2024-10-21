var Sequelize = require('sequelize');
var EnvironmentConfig = require('../config/EnvironmentConfig').EnvironmentConfig;

var models;

function generateModels() {
    var indexConnectionSettings = {
        host: EnvironmentConfig.getProperty('org-db','ORG_DB_PGB_HOST'),
        port: parseInt(EnvironmentConfig.getProperty('org-db','ORG_DB_PGB_PORT')),
        ssl: {
            rejectUnauthorized: false
        },
        dialect: 'postgres',
        protocol: 'postgres',
        logging: false,
        pool: {
            max: 3
        },
        dialectOptions: {
            keepAlive: true,
            ssl: {
                rejectUnauthorized: false
            }
        }
    };

    //console.log('Connecting to index host: ' + EnvironmentConfig.getProperty('org-db','ORG_DB_PGB_HOST'));
    //console.log('Connecting to index port: ' + EnvironmentConfig.getProperty('org-db','ORG_DB_PGB_PORT'));

    var sqlz = new Sequelize(
        EnvironmentConfig.getProperty('index-db','DB_IDX_DB'), 
        EnvironmentConfig.getProperty('org-db','ORG_DB_RDS_SERVICE_USER'), 
        EnvironmentConfig.getProperty('org-db','DB_ORG_PASS'), 
        indexConnectionSettings);

    var IndexUser = sqlz.define('IndexUser', {
        userId: { 
            type: Sequelize.BIGINT, 
            field: "usr_id", 
            allowNull: false, 
            primaryKey: true 
        },
            
        userName: { 
            type: Sequelize.STRING(100),
            field: "usr_nm",
            allowNull: false 
        },
            
        password: { 
            type: Sequelize.STRING(1000),
            field: "passwd", 
            allowNull: false 
        },
            
        firstName: { 
            type: Sequelize.STRING(100),
            field: "frst_nm", 
            allowNull: false 
        },
            
        lastName: { 
            type: Sequelize.STRING(100), 
            field: "last_nm",
            allowNull: false 
        }, 
            
        emailAddress: { 
            type: Sequelize.STRING(1000),
            field: "email_addr", 
            allowNull: false 
        },
            
        passwordResetCode: { 
            type: Sequelize.STRING(1000),
            field: "passwd_reset_cd", 
            allowNull: true 
        },
            
        passwordResetExprDttm: { 
            type: Sequelize.DATE,
            field: "passwd_reset_expr_dttm", 
            allowNull:true 
        },
            
        activeIndicator: { 
            type: Sequelize.BOOLEAN,
            field: "actv_ind",
            allowNull: false 
        },
            
        createTime: {
            type: Sequelize.DATE,
            field: "ins_dttm",
            allowNull: false
        },
            
        updateTime: {
            type: Sequelize.DATE,
            field: "upd_dttm",
            allowNull: false
        },
            
        auditVersion: {
            type: Sequelize.INTEGER,
            field: "aud_ver",
            allowNull: false
        }
    },{
        tableName: 'usr',
        timestamps: false
    });

    var Organization = sqlz.define('Organization', {
        organizationId: { 
            type: Sequelize.BIGINT, 
            field: "org_id", 
            allowNull: false, 
            primaryKey: true 
        },
            
        organizationName: { 
            type: Sequelize.STRING(1000),
            field: "org_nm",
            allowNull: false 
        },
            
        organizationNameInternal: { 
            type: Sequelize.STRING(1000),
            field: "org_nm_intrnl", 
            allowNull: false 
        },
            
        activeIndicator: { 
            type: Sequelize.BOOLEAN,
            field: "actv_ind",
            allowNull: false 
        },
            
        createTime: {
            type: Sequelize.DATE,
            field: "ins_dttm",
            allowNull: false
        },
            
        updateTime: {
            type: Sequelize.DATE,
            field: "upd_dttm",
            allowNull: false
        },
            
        auditVersion: {
            type: Sequelize.INTEGER,
            field: "aud_ver",
            allowNull: false
        }
    },{
    tableName: 'org',
    timestamps: false
    });

    var OrganizationOption = sqlz.define('OrganizationOption', {
        optionId: { 
            type: Sequelize.BIGINT, 
            field: "opt_id", 
            allowNull: false, 
            primaryKey: true 
        },

        organizationId: { 
            type: Sequelize.BIGINT, 
            field: "org_id", 
            allowNull: false
        },
            
        optionName: { 
            type: Sequelize.STRING(1000),
            field: "opt_nm",
            allowNull: false 
        },
            
        optionValue: { 
            type: Sequelize.TEXT(),
            field: "opt_val", 
            allowNull: false 
        },

        createTime: {
            type: Sequelize.DATE,
            field: "ins_dttm",
            allowNull: false
        },
            
        updateTime: {
            type: Sequelize.DATE,
            field: "upd_dttm",
            allowNull: false
        },
            
        auditVersion: {
            type: Sequelize.INTEGER,
            field: "aud_ver",
            allowNull: false
        }
    },{
    tableName: 'org_opt',
    timestamps: false
    });

    IndexUser.belongsToMany(Organization, {
        as: 'organizations',
        through: 'org_usr',
        foreignKey: 'usr_id',
        otherKey: 'org_id',
        timestamps: false
    });

    Organization.belongsToMany(IndexUser, {
        through: 'org_usr',
        foreignKey: 'org_id',
        otherKey: 'usr_id',
        timestamps: false
    });

    Organization.hasMany(OrganizationOption, {
        as: 'options',
        foreignKey: 'org_id'
    });

    models = {
        IndexUser: IndexUser,
        Organization: Organization,
        OrganizationOption: OrganizationOption
    }
}

module.exports = {
    getModels: function() {
        if(!models) {
            generateModels();
        }
        return models;
    }
}

