import { createConnection, getConnection, Connection } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { EnvironmentConfig, ConfigGroup } from '../../config/EnvironmentConfig';

let frameworkConnection: Connection;

// This function is still in use for the Flow Script tests. These need to be rewritten and then this can be removed
export async function initializeGlobalConnections() {
    await getFrameworkConnection();
}

/**
 * Get the framework connection
 *
 * @export
 * @returns {Promise<Connection>}
 */
export async function getFrameworkConnection(
    options: { isReadOnly?: boolean } = { isReadOnly: false },
): Promise<Connection> {
    if (frameworkConnection) {
        return frameworkConnection;
    }

    const port = parseInt(
        EnvironmentConfig.getProperty(
            ConfigGroup.FRAMEWORKDB,
            options.isReadOnly ? 'FW_DB_PGB_RO_PORT' : 'FW_DB_PGB_PORT',
        ),
    );
    const host = EnvironmentConfig.getProperty(
        ConfigGroup.FRAMEWORKDB,
        options.isReadOnly ? 'FW_DB_PGB_RO_HOST' : 'FW_DB_PGB_HOST',
    );

    const frameworkTypeOrmConfig: PostgresConnectionOptions = {
        name: 'framework',
        type: 'postgres',
        host,
        port,
        logging: false,
        schema: 'graphium',
        username: EnvironmentConfig.getProperty(ConfigGroup.FRAMEWORKDB, 'FW_DB_RDS_SERVICE_USER'),
        password: EnvironmentConfig.getProperty(ConfigGroup.FRAMEWORKDB, 'FW_DB_RDS_SERVICE_PASS'),
        database: EnvironmentConfig.getProperty(ConfigGroup.FRAMEWORKDB, 'FW_DB_NAME'),
        entities: [],
        ssl: EnvironmentConfig.environment !== 'local' ? {
            rejectUnauthorized: false
        } : false
    };

    try {
        frameworkConnection = await createConnection(frameworkTypeOrmConfig);
        return frameworkConnection;
    } catch (error) {
        throw error;
    }
}
