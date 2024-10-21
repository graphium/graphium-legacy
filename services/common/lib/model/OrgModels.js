var Sequelize = require('sequelize');
var indexModels = require('./IndexModels.js');
var EnvironmentConfig = require('../config/EnvironmentConfig').EnvironmentConfig;

var _ = require('lodash');
const { OrgUser } = require('../v2/entity/index/OrgUser.js');

function getModelsForOrg(orgInternalName, readOnly) {
    return getConnectionForOrg(orgInternalName, readOnly)
    .then(function(connection) {
        return connection.models;
    });
}

function queryReadOnly(orgInternalName, query, options) {
    return getConnectionForOrg(orgInternalName, true)
    .then(function(connection) {
        return connection.connection.query(query, options);
    })
}

function query(orgInternalName, query, options) {
    return getConnectionForOrg(orgInternalName)
    .then(function(connection) {
        return connection.connection.query(query, options);
    })
}

function createOrgUserTransaction(orgInternalName, orgUserId) {

    var connection, transaction;
    return getConnectionForOrg(orgInternalName)
    .then(function(connectionResult) {
        connection = connectionResult;
        return connection.connection.transaction();
    })
    .then(function(transactionResult) {
        transaction = transactionResult;
        return connection.connection.query(
            `SET LOCAL application_name = 'appUsrId~1'`, 
            { 
                type:Sequelize.QueryTypes.RAW, 
                replacements: { orgUserId:orgUserId }, 
                transaction: transaction 
            });
    })
    .then(function(setLocalResult) {
        return Promise.resolve({
            connection:connection.connection, 
            transaction:transaction,
            models: connection.models
        });
    });
}

var sequelizeConnectionMap = {};
function getOrgDbUrl(orgInternalName) {
    var Organization = indexModels.getModels().Organization;

    return Organization.findOne({
        where: { organizationNameInternal: orgInternalName },
        include: [{ model:indexModels.getModels().OrganizationOption, as:'options' }]
    })
    .then(function(organization) {
        if(!organization) {
            return Promise.reject(new Error('Unable to find organization in index table.'));
        }
        var options = organization.toJSON().options;
        var dbUrlOption = _.find(options,{optionName:'db_url'});
        if(!dbUrlOption || !dbUrlOption.optionValue)
            return Promise.reject(new Error('Unable to retrieve database URL, option for organization not found.'));
        else
            return Promise.resolve(dbUrlOption.optionValue);
    })
    .catch(function(error) {
        error.message = 'Unable to retrieve database URL: ' + error.message;
        return Promise.reject(error);
    });
}

function getConnectionForOrg(orgInternalName, readOnly) {
    var connectionKey = orgInternalName + (readOnly === true ? '_ro' : '_rw');
    //console.log('Attempting to get connection for key: ' + connectionKey);

    if(!sequelizeConnectionMap[connectionKey]) {
        //console.log('Connection doesn\'t exist for key, creating connection.');

        //console.log('Retrieving org db url.');
        return getOrgDbUrl(orgInternalName)
        .then(function(orgDbUrl) {

            //console.log('Retrieved org db url: ' + orgDbUrl);

            // We parse the url with the 'jdbc:' removed.
            var urlParts = require('url').parse(_.replace(orgDbUrl,/^(jdbc\:)/,''));
            //var dbHost = urlParts.hostname;
            //var dbPort = urlParts.port ? parseInt(urlParts.port) : undefined;
            var dbHostParameterName = readOnly === true ? 'ORG_DB_PGB_RO_HOST' : 'ORG_DB_PGB_HOST';
            var dbHost = EnvironmentConfig.getProperty('org-db',dbHostParameterName);
            var dbPortParameterName = readOnly === true ? 'ORG_DB_PGB_RO_PORT' : 'ORG_DB_PGB_PORT';
            var dbPort = parseInt(EnvironmentConfig.getProperty('org-db',dbPortParameterName));
            var database = _.compact(urlParts.pathname.split('/'))[0];

            //console.log('Connecting to org host: ' + dbHost);
            //console.log('Connecting to org port: ' + dbPort);
            
            var connectionSettings = {
                host: dbHost,
                port: dbPort,
                ssl: {
                    rejectUnauthorized: false
                },
                logging: false,
                dialect: 'postgres',
                protocol: 'postgres',
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

            //console.log('Connecting to org with options:' + JSON.stringify(connectionSettings));
            var dbUser = EnvironmentConfig.getProperty('org-db','ORG_DB_RDS_SERVICE_USER');
            var dbPass = EnvironmentConfig.getProperty('org-db','ORG_DB_RDS_SERVICE_PASS');
            var connection = new Sequelize(database, dbUser, dbPass, connectionSettings );
            var models = generateDefinitions(connection);
            sequelizeConnectionMap[connectionKey] = {
                readOnly: readOnly,
                connection: connection,
                models:models
            };

            return Promise.resolve(sequelizeConnectionMap[connectionKey]);
        });
    }
    return Promise.resolve(sequelizeConnectionMap[connectionKey]);
}

function generateDefinitions(sequelize) {

    var OrganizationUser = sequelize.define('OrganizationUser', {
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

    var Organization = sequelize.define('Organization', {
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

    var FacilityOption = sequelize.define('FacilityOption', {
        optionId: { 
            type: Sequelize.BIGINT, 
            field: "opt_id", 
            allowNull: false, 
            primaryKey: true 
        },

        facilityId: { 
            type: Sequelize.BIGINT, 
            field: "fac_id", 
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
    tableName: 'fac_opt',
    timestamps: false
    });

    var Provider = sequelize.define('Provider', {
        providerId: { 
            type: Sequelize.BIGINT, 
            field: "prvr_id", 
            allowNull: false, 
            primaryKey: true 
        },

        facilityId: { 
            type: Sequelize.INTEGER, 
            field: "fac_id", 
            allowNull: false, 
            primaryKey: true 
        },
            
        providerType: { 
            type: Sequelize.STRING(1000),
            field: "prvr_typ",
            allowNull: false 
        },
            
        firstName: { 
            type: Sequelize.STRING(1000),
            field: "frst_nm", 
            allowNull: false 
        },

        lastName: { 
            type: Sequelize.STRING(1000),
            field: "last_nm", 
            allowNull: false 
        },
            
        nationalProviderId: { 
            type: Sequelize.STRING(1000),
            field: "natl_prvr_id", 
            allowNull: false 
        },

        localProviderId: { 
            type: Sequelize.STRING(1000),
            field: "local_prvr_id", 
            allowNull: false 
        },

        speciality: { 
            type: Sequelize.STRING(1000),
            field: "spclty", 
            allowNull: false 
        },

        groupName: { 
            type: Sequelize.STRING(1000),
            field: "group_nm", 
            allowNull: true 
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
			tableName: 'prvr',
			timestamps: false
    });

    var Facility = sequelize.define('Facility', {
        facilityId: { 
            type: Sequelize.BIGINT, 
            field: "fac_id", 
            allowNull: false, 
            primaryKey: true 
        },

        organizationId: { 
            type: Sequelize.INTEGER, 
            field: "org_id", 
            allowNull: false
        },
            
        facilityName: { 
            type: Sequelize.STRING(1000),
            field: "fac_nm",
            allowNull: false 
        },
            
        facilityDescription: { 
            type: Sequelize.TEXT(),
            field: "fac_desc", 
            allowNull: true 
        },

        addressLine1: { 
            type: Sequelize.STRING(1000),
            field: "addr_ln_1", 
            allowNull: true 
        },

        addressLine2: { 
            type: Sequelize.STRING(1000),
            field: "addr_ln_2", 
            allowNull: true 
        },

        addressCityName: { 
            type: Sequelize.STRING(1000),
            field: "addr_city_nm", 
            allowNull: true 
        },

        addressStateCode: { 
            type: Sequelize.STRING(100),
            field: "addr_st_cd", 
            allowNull: true 
        },

        addressZipCode: { 
            type: Sequelize.STRING(100),
            field: "addr_zip_cd", 
            allowNull: true 
        },

        phoneNumberMain: { 
            type: Sequelize.STRING(100),
            field: "ph_no_main", 
            allowNull: true 
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
        },

        facilityNameInternal: {
            type: Sequelize.TEXT(),
            field: "fac_nm_intrnl",
            allowNull: false
        },

        testFacilityIndicator: {
            type: Sequelize.BOOLEAN,
            field: "test_fac_ind",
            allowNull: false
        },

        subscriptionData: {
            type: Sequelize.JSONB,
            field: "subscription_data",
            allowNull: true
        }
    },{
			tableName: 'fac',
			timestamps: false
    });

    Facility.hasMany(FacilityOption, {
        as: 'options',
        foreignKey: 'fac_id'
    });

    var Role = sequelize.define('Role', {
        roleId: { 
            type: Sequelize.INTEGER, 
            field: "role_id", 
            allowNull: false, 
            primaryKey: true 
        },
            
        roleName: { 
            type: Sequelize.STRING(1000),
            field: "role_nm",
            allowNull: false 
        },
            
        roleDescription: { 
            type: Sequelize.TEXT(),
            field: "role_desc", 
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
			tableName: 'org_role',
			timestamps: false
    });

    var Permission = sequelize.define('Permission', {
        permissionId: { 
            type: Sequelize.INTEGER, 
            field: "perm_id", 
            allowNull: false, 
            primaryKey: true 
        },
            
        categoryName: { 
            type: Sequelize.STRING(1000),
            field: "catg_nm",
            allowNull: false 
        },
        
        permissionName: { 
            type: Sequelize.STRING(1000),
            field: "perm_nm",
            allowNull: false 
        },

        permissionDescription: { 
            type: Sequelize.TEXT(),
            field: "perm_desc", 
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
			tableName: 'perm',
			timestamps: false
    });

    var ValueSet = sequelize.define('ValueSet', {
        valueSetId: { 
            type: Sequelize.INTEGER, 
            field: "val_set_id", 
            allowNull: false, 
            primaryKey: true 
        },
            
        facilityId: { 
            type: Sequelize.INTEGER,
            field: "fac_id",
            allowNull: true 
        },
        
        valueSetType: { 
            type: Sequelize.STRING(100),
            field: "val_set_typ",
            allowNull: false 
        },

        categoryName: { 
            type: Sequelize.STRING(1000),
            field: "catg_nm", 
            allowNull: false 
        },

        valueSetName: { 
            type: Sequelize.STRING(1000),
            field: "val_set_nm", 
            allowNull: false 
        },

        valueSetDescription: { 
            type: Sequelize.TEXT(),
            field: "val_set_desc", 
            allowNull: false 
        },

        attributeList: { 
            type: Sequelize.TEXT(),
            field: "attr_list", 
            allowNull: false 
        },

        dynamicSqlText: { 
            type: Sequelize.TEXT(),
            field: "dyn_sql_txt", 
            allowNull: true 
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
			tableName: 'val_set',
			timestamps: false
    });

    var ValueSetDetail = sequelize.define('ValueSetDetail', {
        
        valueSetDetailId: { 
            type: Sequelize.INTEGER, 
            field: "val_set_dtl_id", 
            allowNull: false, 
            primaryKey: true 
        },

        valueSetId: { 
            type: Sequelize.INTEGER, 
            field: "val_set_id", 
            allowNull: false
        },
            
        valueList: { 
            type: Sequelize.HSTORE,
            field: "val_list",
            allowNull: true 
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
			tableName: 'val_set_dtl',
			timestamps: false
    });

    var ScoreCardMetric = sequelize.define('ScoreCardMetric', {
        organizationId: { 
            type: Sequelize.BIGINT,
            field: "org_id",
            allowNull: false,
            primaryKey: true
        },
        facilityId: {
            type: Sequelize.INTEGER,
            field: "fac_id",
            allowNull: false
        },
        dateOfService: {
            type: Sequelize.DATE,
            field: "dos",
            allowNull: false
        },
        caseCount: {
            type:Sequelize.INTEGER,
            field: "case_cnt",
            allowNull: false
        },
        anesthesiaMinutes: {
            type: Sequelize.INTEGER,
            field: "anes_mins",
            allowNull: true
        },
        surgeonTurnoverTimeSurgeonMinutes: {
            type: Sequelize.NUMERIC,
            field: "surgn_tot_surgn_mins",
            allowNull: true
        },
        surgeonTurnoverTimeSurgeonCount: {
            type: Sequelize.INTEGER,
            field: "surgn_tot_surgn_case_cnt",
            allowNull: false
        },
        surgeonTurnoverTimeLocationMinutes: {
            type: Sequelize.NUMERIC,
            field: "surgn_tot_locn_mins",
            allowNull: true
        },
        surgeonTurnoverTimeLocationCount: {
            type: Sequelize.INTEGER,
            field: "surgn_tot_locn_case_cnt",
            allowNull: false
        },
        wheelsOutWheelsInMinutes: {
            type: Sequelize.NUMERIC,
            field: "wowi_mins",
            allowNull: true
        },
        wheelsOutWheelsInCount: {
            type: Sequelize.INTEGER,
            field: "wowi_case_cnt",
            allowNull: false
        },
        anesthesiaTurnoverTimeMinutes: {
            type: Sequelize.NUMERIC,
            field: "anes_tot_mins",
            allowNull: true
        },
        anesthesiaTurnoverTimeCount: {
            type: Sequelize.INTEGER,
            field: "anes_tot_case_cnt",
            allowNull: false
        },
        anesthesiaReadyMinutes: {
            type: Sequelize.INTEGER,
            field: "anes_rdy_mins",
            allowNull: true
        },
        surgicalPrepMinutes: {
            type: Sequelize.INTEGER,
            field: "surg_prep_mins",
            allowNull: true
        },
        firstCaseCount: {
            type: Sequelize.INTEGER,
            field: "first_case_cnt",
            allowNull: false,
        },
        firstCaseDelayCount: {
            type: Sequelize.INTEGER,
            field: "first_case_delay_cnt",
            allowNull: false,
        },
        firstCaseDelayMinutes: {
            type: Sequelize.INTEGER,
            field: "first_case_delay_mins",
            allowNull: false
        },
        icuAdmissionCount: {
            type: Sequelize.INTEGER,
            field: "icu_admission_cnt",
            allowNull: false
        },
        pacuAdmissionCount: {
            type: Sequelize.INTEGER,
            field: "pacu_admission_cnt",
            allowNull: false
        },
        generalAnesthesiaCount: {
            type: Sequelize.INTEGER,
            field: "general_anes_cnt",
            allowNull: false
        },
        macAnesthesiaCount: {
            type: Sequelize.INTEGER,
            field: "mac_anes_cnt",
            allowNull: false
        },
        regionalAnesthesiaCount: {
            type: Sequelize.INTEGER,
            field: "regional_anes_cnt",
            allowNull: false
        },
        spinalAnesthesiaCount: {
            type: Sequelize.INTEGER,
            field: "spinal_anes_cnt",
            allowNull: false
        },
        epiduraAnesthesiaCount: {
            type: Sequelize.INTEGER,
            field: "epidural_anes_cnt",
            allowNull: false
        },
        laborEpiduralAnesthesiaCount: {
            type: Sequelize.INTEGER,
            field: "labor_epidural_anes_cnt",
            allowNull: false
        },
        localAnesthesiaCount: {
            type: Sequelize.INTEGER,
            field: "local_anes_cnt",
            allowNull: false
        },
        topicalAnesthesiaCount: {
            type: Sequelize.INTEGER,
            field: "topical_anes_cnt",
            allowNull: false
        },
        safetyChecklistUsedCount: {
            type: Sequelize.INTEGER,
            field: "safety_chklst_used_cnt",
            allowNull: false
        },
        handoffProtocolUsedCount: {
            type: Sequelize.INTEGER,
            field: "handoff_proto_used_cnt",
            allowNull: false
        },
        inpatientPatientCount: {
            type: Sequelize.INTEGER,
            field: "inpatient_pat_cnt",
            allowNull: false
        },
        ambulatoryPatientCount: {
            type: Sequelize.INTEGER,
            field: "ambulatory_pat_cnt",
            allowNull: false
        },
        hypothermicPatientCount: {
            type: Sequelize.INTEGER,
            field: "hypothermic_pat_cnt",
            allowNull: false
        },
        observationCount: {
            type: Sequelize.INTEGER,
            field: "nonmajor_comp_cnt",
            allowNull: false
        },
        majorComplicationCount: {
            type: Sequelize.INTEGER,
            field: "major_comp_cnt",
            allowNull: false
        },
        sameDayAddOnCount: {
            type: Sequelize.INTEGER,
            field: "sameday_addon_cnt",
            allowNull: false
        },
        cancelledCaseCount: {
            type: Sequelize.INTEGER,
            field: "case_cancel_cnt",
            allowNull: false
        },
        delayedCaseCount: {
            type: Sequelize.INTEGER,
            field: "case_delay_cnt",
            allowNull: false
        },
        preopPriorCount: {
            type: Sequelize.INTEGER,
            field: "preop_prior_cnt",
            allowNull: false
        },
        lungVentilationCount: {
            type: Sequelize.INTEGER,
            field: "airway_lung_prot_vent_cnt",
            allowNull: false
        },
        currentMedsDocumentCount: {
            type: Sequelize.INTEGER,
            field: "prvr_attest_curr_med_cnt",
            allowNull: false
        },
        ponvHighRiskCount: {
            type: Sequelize.INTEGER,
            field: "ponv_high_risk_cnt",
            allowNull: false
        },
        combinationTherapyCount: {
            type: Sequelize.INTEGER,
            field: "comb_ther_cnt",
            allowNull: false
        },
        asaFrequencyDistribution: {
            type: Sequelize.TEXT,
            field: "asa_dist_list",
            allowNull: false
        },
        ageFrequencyDistribution: {
            type: Sequelize.TEXT,
            field: "age_dist_list",
            allowNull: false
        },
        genderFrequencyDistribution: {
            type: Sequelize.TEXT,
            field: "gender_dist_list",
            allowNull: false
        },
        painScoreFrequencyDistribution: {
            type: Sequelize.TEXT,
            field: "pain_score_dist_list",
            allowNull: false
        },

        locationUtilization: {
            type: Sequelize.TEXT,
            field: "locn_util",
            allowNull: true
        },
        hourlyORUtilization: {
            type: Sequelize.TEXT,
            field: "hourly_or_util",
            allowNull: true
        },
        complicationsList: {
            type: Sequelize.ARRAY(Sequelize.HSTORE),
            field: "comp_list",
            allowNull: true
        },
        delayReasonsList: {
            type: Sequelize.HSTORE,
            field: "delay_rsn_list",
            allowNull: true
        },
        cancelReasonsList: {
            type: Sequelize.HSTORE,
            field: "cancel_rsn_list",
            allowNull: true
        },

        insertTimestamp: {
            type: Sequelize.TIME,
            field: "ins_dttm",
            allowNull: false
        },
        lastUpdateTimestamp: {
            type: Sequelize.TIME,
            field: "upd_dttm",
            allowNull: false
        },
        auditVersion: {
            type: Sequelize.INTEGER,
            field: "aud_ver",
            allowNull: false
        }
    }, {
        tableName: 'scorecard_metrics',
        timestamps: false
    });

    var Encounter = sequelize.define('Encounter', {
        encounterId: { 
            type: Sequelize.BIGINT,
            field: "enctr_id",
            allowNull: false,
            primaryKey: true
        },
        facilityId: {
            type: Sequelize.INTEGER,
            field: "fac_id",
            allowNull: false
        },
        encounterNumber: {
            type: Sequelize.STRING(100),
            field: "enctr_no",
            allowNull: true
        },
        patientMrn: {
            type:Sequelize.STRING(100),
            field: "pat_mrn",
            allowNull: true
        },
        patientLastName: {
            type: Sequelize.STRING(1000),
            field: "pat_last_nm",
            allowNull: true
        },
        patientFirstName: {
            type: Sequelize.STRING(1000),
            field: "pat_frst_nm",
            allowNull: true
        },
        patientMiddleName: {
            type: Sequelize.STRING(1000),
            field: "pat_mid_nm",
            allowNull: true
        },
        patientSsn: {
            type: Sequelize.STRING(100),
            field: "pat_ssn",
            allowNull: true
        },
        patientDob: {
            type: Sequelize.DATE,
            field: "pat_dob",
            allowNull: true
        },
        patientZipCode: {
            type: Sequelize.STRING(100),
            field: "pat_zip_cd",
            allowNull: true
        },
        admitDate: {
            type: Sequelize.DATE,
            field: "admit_dt",
            allowNull: true,
        },
        admitTime: {
            type: Sequelize.TIME,
            field: "admit_tm",
            allowNull: true,
        },
        dischargeDate: {
            type: Sequelize.DATE,
            field: "disch_dt",
            allowNull: true
        },
        dischargeTime: {
            type: Sequelize.TIME,
            field: "disch_tm",
            allowNull: true
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
        },
        purged: {
            type: Sequelize.BOOLEAN,
            field: "purged_ind",
            allowNull: false
        },
        purgedTime: {
            type: Sequelize.DATE,
            field: "purged_dttm",
            allowNull: true
        },
        patientAddressLine1: {
            type: Sequelize.TEXT,
            field: "pat_addr_ln_1",
            allowNull: true
        },
        patientAddressLine2: {
            type: Sequelize.TEXT,
            field: "pat_addr_ln_2",
            allowNull: true
        },
        patientCity: {
            type: Sequelize.TEXT,
            field: "pat_city",
            allowNull: true
        },
        patientState: {
            type: Sequelize.TEXT,
            field: "pat_state_cd",
            allowNull: true
        },
        patientCountryCode: {
            type: Sequelize.TEXT,
            field: "pat_cntry_cd",
            allowNull: true
        },
        patientHomePhone: {
            type: Sequelize.TEXT,
            field: "pat_ph_no_home",
            allowNull: true
        },
        patientWorkPhone: {
            type: Sequelize.TEXT,
            field: "pat_ph_no_bus",
            allowNull: true
        },
        patientMobilePhone: {
            type: Sequelize.TEXT,
            field: "pat_ph_no_mob",
            allowNull: true
        },
        patientHomeEmail: {
            type: Sequelize.TEXT,
            field: "pat_email_home",
            allowNull: true
        },
        patientWorkEmail: {
            type: Sequelize.TEXT,
            field: "pat_email_bus",
            allowNull: true
        },
        patientDriversLicenseNum: {
            type: Sequelize.TEXT,
            field: "pat_dr_lic_no",
            allowNull: true
        },
        patientDriversLicenseState: {
            type: Sequelize.TEXT,
            field: "pat_dr_lic_st",
            allowNull: true
        },
        patientDriversLicenseExpDt: {
            type: Sequelize.TEXT,
            field: "pat_dr_lic_exp",
            allowNull: true
        },
        patientOccupation: {
            type: Sequelize.TEXT,
            field: "pat_occup",
            allowNull: true
        },
        patientPrimaryLanguage: {
            type: Sequelize.TEXT,
            field: "pat_prim_lang",
            allowNull: true
        },
        patientMaritalStatus: {
            type: Sequelize.TEXT,
            field: "pat_marital_status",
            allowNull: true
        },
        patientReligion: {
            type: Sequelize.TEXT,
            field: "pat_religion",
            allowNull: true
        },
        patientGenderCd: {
            type: Sequelize.TEXT,
            field: "pat_gender_cd",
            allowNull: true
        },
        patientRace: {
            type: Sequelize.TEXT,
            field: "pat_race",
            allowNull: true
        },
        patientEthnicGroup: {
            type: Sequelize.TEXT,
            field: "pat_ethnic_grp",
            allowNull: true
        },
        patientNationality: {
            type: Sequelize.TEXT,
            field: "pat_nationality",
            allowNull: true
        },
        patientDeceased: {
            type: Sequelize.BOOLEAN,
            field: "pat_deceased_ind",
            allowNull: true
        },
        patientDeceasedDt: {
            type: Sequelize.DATE,
            field: "pat_deceased_dt",
            allowNull: true
        },
        admitType: {
            type: Sequelize.TEXT,
            field: "enctr_admit_typ",
            allowNull: true
        },
        patientClass: {
            type: Sequelize.TEXT,
            field: "enctr_pat_class",
            allowNull: true
        },
        patientType: {
            type: Sequelize.TEXT,
            field: "enctr_pat_typ",
            allowNull: true
        },
        hospitalServiceCode: {
            type: Sequelize.TEXT,
            field: "enctr_hosp_svc_cd",
            allowNull: true
        },
        accidentDate: {
            type: Sequelize.DATE,
            field: "acc_dt",
            allowNull: true
        },
        accidentCode: {
            type: Sequelize.TEXT,
            field: "acc_cd",
            allowNull: true
        },
        accidentDescription: {
            type: Sequelize.TEXT,
            field: "acc_desc",
            allowNull: true
        },
        accidentLocation: {
            type: Sequelize.TEXT,
            field: "acc_locn",
            allowNull: true
        },
        accidentAutoStateCode: {
            type: Sequelize.TEXT,
            field: "acc_auto_st_cd",
            allowNull: true
        },
        accidentAutoStateName: {
            type: Sequelize.TEXT,
            field: "acc_auto_st_nm",
            allowNull: true
        },
        accidentJobRelated: {
            type: Sequelize.TEXT,
            field: "acc_job_rel_ind",
            allowNull: true
        },
        accidentDeath: {
            type: Sequelize.TEXT,
            field: "acc_death_ind",
            allowNull: true
        },
        insuranceDocument: {
            type: Sequelize.JSON,
            field: "enctr_insurance_doc",
            allowNull: true
        },
        diagnosisDocument: {
            type: Sequelize.JSON,
            field: "enctr_diagnosis_doc",
            allowNull: true
        },
        relationsDocument: {
            type: Sequelize.JSON,
            field: "enctr_relations_doc",
            allowNull: true
        },
        guarantorDocument: {
            type: Sequelize.TEXT,
            field: "enctr_guarantor_doc",
            allowNull: true
        },
        financialClass: {
            type: Sequelize.TEXT,
            field: "enctr_fin_class",
            allowNull: true
        },
        statusCode: {
            type: Sequelize.TEXT,
            field: "enctr_stat_cd",
            allowNull: false
        }
    }, {
        tableName: 'enctr',
        timestamps: false
    });

    var AutomatedDispenseSystem = sequelize.define('AutomatedDispenseSystem', {
        optionId: { 
            type: Sequelize.BIGINT, 
            field: "system_id", 
            allowNull: false, 
            primaryKey: true 
        },

        facilityId: { 
            type: Sequelize.BIGINT, 
            field: "fac_id", 
            allowNull: false
        },
            
        systemCode: { 
            type: Sequelize.STRING(1000),
            field: "system_code",
            allowNull: false 
        },
            
        displayName: { 
            type: Sequelize.TEXT(),
            field: "display_name", 
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
        },

        activeIndicator: { 
            type: Sequelize.BOOLEAN,
            field: "actv_ind",
            allowNull: false 
        }
    },{
    tableName: 'fac_opt',
    timestamps: false
    });

    Role.belongsToMany(OrganizationUser, {
        as: 'users',
        through: 'usr_role',
        foreignKey: 'role_id',
        otherKey: 'usr_id',
        timestamps: false
    });
    
    OrganizationUser.belongsToMany(Role, {
        as: 'roles',
        through: 'usr_role',
        foreignKey: 'usr_id',
        otherKey: 'role_id',
        timestamps: false
    });

    Role.belongsToMany(Permission, {
        as: 'permissions',
        through: 'role_perm',
        foreignKey: 'role_id',
        otherKey: 'perm_id',
        timestamps: false
    });
    
    Permission.belongsToMany(Role, {
        as: 'roles',
        through: 'role_perm',
        foreignKey: 'perm_id',
        otherKey: 'role_id',
        timestamps: false
    });

    OrganizationUser.hasOne(Provider, {
        as: 'provider',
        foreignKey: 'prvr_id'
    });

    OrganizationUser.belongsToMany(Facility, {
        as: 'facilities',
        through: 'fac_usr',
        foreignKey: 'usr_id',
        otherKey: 'fac_id',
        timestamps: false
    });

    Facility.hasMany(Encounter, {foreignKey: 'facilityId', sourceKey: 'fac_id'});
    Encounter.belongsTo(Facility, {as: 'facility', foreignKey: 'facilityId'});

    return {
        OrganizationUser: OrganizationUser,
        Organization: Organization,
        Provider: Provider,
        Facility: Facility,
        Role: Role,
        Permission: Permission,
        ValueSet: ValueSet,
        ValueSetDetail: ValueSetDetail,
        ScoreCardMetric: ScoreCardMetric,
        Encounter: Encounter,
        FacilityOption: FacilityOption,
        AutomatedDispenseSystem: AutomatedDispenseSystem
    };
};

module.exports = {
    getModelsForOrg: getModelsForOrg,
    getConnectionForOrg: getConnectionForOrg,
    query: query,
    queryReadOnly: queryReadOnly,
    createOrgUserTransaction: createOrgUserTransaction
};
