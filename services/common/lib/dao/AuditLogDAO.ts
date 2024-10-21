import { Transaction, Sequelize, QueryOptions, QueryTypes } from 'sequelize';
import * as _ from 'lodash';
import * as orgModels from '../model/OrgModels.js';

export async function createUserLoginAuditLog( orgInternalName:string, orgUserId:number ):Promise<boolean> {

    let connection = await <{transaction:Transaction, connection:Sequelize}>orgModels.createOrgUserTransaction(orgInternalName, orgUserId);

    let query = `SELECT aud_create_audit_entry(:orgUserId, 'USER_LOGIN', NULL, NULL);`
    let options = <QueryOptions>{
      type: QueryTypes.RAW,
      replacements: {
        orgUserId: orgUserId
      },
      transaction: connection.transaction
    }

    try {
        let queryResult = await connection.connection.query(query,options);
        let commitResult = await connection.transaction.commit();
        return true;
    }
    catch(error) {
        console.error(error.message);
        return false;
    }
}