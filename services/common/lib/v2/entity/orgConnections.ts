import { createConnection, getConnection, Connection, EntitySchema } from 'typeorm';
import 'reflect-metadata';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { User } from './index/User';
import { Invite } from './index/Invite';
import { AudLog } from './index/AudLog';
import { AudType } from './index/AudType';
import { AuditQueue as Index_AuditQueue } from './index/AuditQueue';
import { Org } from './index/Org';
import { OrgOpt } from './index/OrgOpt';
import { OrgUser } from './index/OrgUser';
import { AuditQueue as Org_AuditQueue } from './org/AuditQueue';
import { Facility } from './org/Facility';
import { FacilityOpt } from './org/FacilityOpt';
import { OrgRole } from './org/OrgRole';
import { Provider } from './org/Provider';
import { RolePerm } from './org/RolePerm';
import { Tag } from './org/Tag';
import { UserPreference } from './org/UserPreference';
import { ValSet } from './org/ValSet';
import { ValSetDetail } from './org/ValSetDetail';
import { Org as Org_Org } from './org/Org';
import { User as Org_User } from './org/User';
import { FacilityUser } from './org/FacilityUser';
import { Patient } from './org/Patient';
import { UserRole } from './org/UserRole';
import { Event } from './org/Event';
import { EnvironmentConfig, ConfigGroup } from '../../config/EnvironmentConfig';
import { EventState } from './org/EventState';
import { Team } from './org/Team';
import { ReferenceListValue } from './org/ReferenceListValue';
import { ReferenceList } from './org/ReferenceList';
import { TeamMembership } from './org/TeamMembership';
import { PatientNeed } from './org/PatientNeed';
import { PatientNeedState } from './org/PatientNeedState';
import { PatientNote } from './org/PatientNote';
import { PatientAttachment } from './org/PatientAttachment';
import { PatientState } from './org/PatientState';
import { Encounter } from './org/Encounter';
import { PatientMedication } from './org/PatientMedication';
import { EncounterForm } from './org/EncounterForm';
import { FormDefinition } from './org/FormDefinition';
import { ModelDefinition } from './org/ModelDefinition';
import { EncounterFormTag } from './org/EncounterFormTag';
import { FormDefinitionPage } from './org/FormDefinitionPage';
import { FormDefinitionHistory } from './org/FormDefinitionHistory';
import { FormDefinitionPageHistory } from './org/FormDefinitionPageHistory';
import { EncounterFormPage } from './org/EncounterFormPage';
import * as EncounterFormSchemaFactory from './org/EncounterFormSchemaFactory';

// Save the index connection so we don't have to reconnect to it
let connection: Connection;

/**
 * Get the index connection
 *
 * @export
 * @returns {Promise<Connection>}
 */
export async function getIndexConnection(): Promise<Connection> {
    if (connection) {
        return connection;
    }
    console.log('Configuring index connection.');

    let host = EnvironmentConfig.getProperty(ConfigGroup.ORG, 'ORG_DB_PGB_HOST');
    let port = parseInt(EnvironmentConfig.getProperty(ConfigGroup.ORG, 'ORG_DB_PGB_PORT'));
    let schema = 'graphium';
    let username = EnvironmentConfig.getProperty(ConfigGroup.INDEX, 'DB_IDX_USER');
    let password = EnvironmentConfig.getProperty(ConfigGroup.INDEX, 'DB_IDX_PASS');
    let database = EnvironmentConfig.getProperty(ConfigGroup.INDEX, 'DB_IDX_DB');

    const indexTypeOrmConfig: PostgresConnectionOptions = {
        name: 'index',
        type: 'postgres',
        //logging: 'all',
        host: host,
        port: port,
        username: username,
        password: password,
        database: database,
        ssl: {
            rejectUnauthorized: false,
        },
        entities: [Index_AuditQueue, User, Invite, AudLog, AudType, Org, OrgOpt, OrgUser],
    };

    try {
        console.log('Creating connection.');
        connection = await createConnection(indexTypeOrmConfig);
        return connection;
    } catch (error) {
        throw error;
    }
}

// Keep track of open org connections so we don't try to reconnect when we already have it
const orgConnections: { [key in string]: Connection } = {};

export async function getOrgConnectionByOrgInternalName(
    orgInternalName: string,
    isReadOnly: boolean = false
): Promise<Connection> {
    if(!orgInternalName || orgInternalName == "") {
        throw new Error('Invalid orgInternalName, cannot get connection.');
    }

    console.log('Getting index connection.');
    let indexConnection = await getIndexConnection();
    console.log('Querying index for org.');
    const org = await indexConnection
        .createQueryBuilder()
        .select('org')
        .from(Org, 'org')
        .where('org.orgNmIntrnl = :orgNameInternal', { orgNameInternal: orgInternalName})
        .getOne();
    console.log('Retrieved org, getting org connection by ID ('+org.orgId+')');
    return await getOrgConnection( org.orgId, isReadOnly );
}


/**
 * Get the org connection
 *
 * @export
 * @param {*} orgId
 * @returns {Promise<Connection>}
 */
export async function getOrgConnection(
    orgId: number,
    isReadOnly: boolean = false,
    additionalEntities: EntitySchema[] = [],
): Promise<Connection> {
    if (!orgId) {
        throw new Error('Invalid orgId');
    }
    if (orgConnections[orgId.toString()]) {
        return orgConnections[orgId.toString()];
    }
    let indexConnection = await getIndexConnection();

    const orgUrl = await indexConnection
        .createQueryBuilder()
        .select('org')
        .from(OrgOpt, 'org')
        .where('org.orgId = :id', { id: orgId })
        .andWhere('org.optNm = :name', { name: 'db_url' })
        .getOne();
    const orgName = await indexConnection
        .createQueryBuilder()
        .select('org')
        .from(OrgOpt, 'org')
        .where('org.orgId = :id', { id: orgId })
        .andWhere('org.optNm = :name', { name: 'db_name' })
        .getOne();

    if (!orgUrl) {
        throw new Error('Invalid org');
    }

    let entities: any[] = [
        Org_AuditQueue,
        Facility,
        FacilityOpt,
        FacilityUser,
        UserRole,
        Org_Org,
        OrgRole,
        Provider,
        RolePerm,
        Tag,
        Org_User,
        UserPreference,
        ValSet,
        ValSetDetail,
        Patient,
        Event,
        EventState,
        Team,
        ReferenceList,
        ReferenceListValue,
        TeamMembership,
        PatientNeed,
        PatientNeedState,
        PatientNote,
        PatientAttachment,
        PatientState,
        Encounter,
        PatientMedication,
        EncounterForm,
        FormDefinition,
        ModelDefinition,
        EncounterFormTag,
        FormDefinitionPage,
        FormDefinitionHistory,
        FormDefinitionPageHistory,
    ];

    let port = parseInt(
        EnvironmentConfig.getProperty(ConfigGroup.ORG, isReadOnly ? 'ORG_DB_PGB_RO_PORT' : 'ORG_DB_PGB_PORT'),
    );
    let host = EnvironmentConfig.getProperty(ConfigGroup.ORG, isReadOnly ? 'ORG_DB_PGB_RO_HOST' : 'ORG_DB_PGB_HOST');
    let schema = 'graphium';
    let username = EnvironmentConfig.getProperty(ConfigGroup.ORG, 'ORG_DB_RDS_SERVICE_USER');
    let password = EnvironmentConfig.getProperty(ConfigGroup.ORG, 'ORG_DB_RDS_SERVICE_PASS');
    let database = orgName.optVal;

    const orgTypeOrmConfig: PostgresConnectionOptions = {
        name: `org_${orgId}_nomodels`,
        type: 'postgres',
        username: username,
        password: password,
        host: host,
        port: port,
        database: database,
        ssl: {
            rejectUnauthorized: false,
        },
        //logging: 'all',
        entities: entities,
    };

    let orgConnection = await createConnection(orgTypeOrmConfig);

    let models = await orgConnection
        .createQueryBuilder()
        .select('model')
        .from(ModelDefinition, 'model')
        .getMany();
    orgConnection.close();

    // These are the entities for the models that we have created in the database. Keep in mind
    // that because we are caching the connections (see the map in this module), if models are added
    // to the database this connection will need to be renewed (best option just restart the services that
    // rely on this connection library.)
    for (let model of models) {
        let schemas = EncounterFormSchemaFactory.getSchemasForModel(model.modelDefnNm);
        entities.push(schemas.PageEntity);
        entities.push(schemas.StrokeEntity);
        entities.push(schemas.BitmapEntity);
        entities.push(schemas.DetailEntity);
    }

    // isn't the spread operator just awesome...
    let updatedConfig: PostgresConnectionOptions = {
        ...orgTypeOrmConfig,
        name: `org_${orgId}`,
        entities: entities,
    };

    orgConnection = await createConnection(updatedConfig);
    orgConnections[orgId.toString()] = orgConnection;
    return orgConnection;
}
