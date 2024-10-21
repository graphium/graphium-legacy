var Bluebird = require('bluebird');
var ddb = require('../util/ddbUtil.js');
var _ = require('lodash');
import * as elasticsearch from 'elasticsearch';

export interface ProvisionerTableMapping {
    table:string,
    type:string,
    idAttribute: string,
    versionAttribute: string,
    maintainItemMap: boolean,
    parentAttribute?: string,
    itemModificationFunction?: Function,
    currentPage: number,
    ddbPageLimit: number,
    dependencies: Array<{
        table: string,
        lookupAttribute: string,
        fetchMode: "provisionItem"|"provisionAll"|"all"
    }>
}

export interface ProvisionerConfig {
    esHost: string,
    esUser: string,
    esPassword: string,
    esPort: number,
    esProtocol: string,
    esIndex: string,
    esTemplate: string,
    tableMappings: ProvisionerTableMapping[]
}

interface BulkUpdateAction {
    update: {
        _index: string,
        _type: string,
        _id: string,
        parent: string
    }
}

interface BulkUpdateDocument {
    doc?: any,
    doc_as_upsert?: boolean,
    script?: {
        inline: string,
        params: {
            doc: any
        }
    },
    upsert?: any
}

export default class DdbProvisioner {

    private esClient:elasticsearch.Client;
    private tableItemMap:Map<string, any>;

    constructor(readonly config:ProvisionerConfig) {

        this.esClient = new elasticsearch.Client({
            host: [
                {
                host: this.config.esHost,
                auth: [this.config.esUser,this.config.esPassword].join(':'),
                protocol: this.config.esProtocol,
                port: this.config.esPort
                }
            ],
            //log: 'trace',
            requestTimeout: 300000
        });

        this.tableItemMap = new Map();
    }

    private async indexExists():Promise<boolean> {
        return this.esClient.indices.exists({index:this.config.esIndex});
    }

    private async updateTemplate():Promise<any> {
        var template = require('../index-templates/' + this.config.esTemplate + '.json');
        return this.esClient.indices.putTemplate({body:template, name:this.config.esTemplate});
    }

    private async createIndex():Promise<any> {
        return this.esClient.indices.create({index:this.config.esIndex});
    }

    async provisionAll() {
        var createdIndex;
        var loadResults;

        console.log('Updating index template.');
        let template = await this.updateTemplate();

        console.log('Template updated: ' + JSON.stringify(template));
        console.log('Checking for existing index.');
        let exists = await this.indexExists();

        console.log('Index exists: ' + JSON.stringify(exists));
        let index = null;
        if(exists) {
            // If the index already exists, let's abort. We shouldn't be doing anything.
            console.log('Index already exists, proceeding to load items.');
        }
        else {
            // Ok, it doesn't exist. Let's first 
            console.log('Index not found, provisioning new index.');
            index = await this.createIndex();
            console.log('Completed provisioning new index: ' + JSON.stringify(index));
            console.log('Loading items from DDB for bulk import.');

            let results = [];
            for(let tableMapping of this.config.tableMappings) {
                console.log('Loading for table mapping: ' + JSON.stringify(tableMapping));
                results.push(await this.loadIndexFromTable(tableMapping));
            }
        }
    }

    async provisionItem(table:string, itemId:string) {
        let tableMapping = this.config.tableMappings.find((tm) => tm.table == table);

        if(!tableMapping) {
            throw new Error('Unable to provision item, table not found in config: ' + table);
        }


    }

    private async loadIndexFromTable(tableMapping:ProvisionerTableMapping) {
        tableMapping.currentPage = 1;
        return this.getNextPageOfItems(tableMapping);
    }

    
    private async bulkUpdateItems(items:any[], tableMapping:ProvisionerTableMapping):Promise<any> {

        var itemMap = this.tableItemMap[tableMapping.table];
        if(!itemMap) {
            itemMap = {};
            this.tableItemMap[tableMapping.table] = itemMap;
        }

        
        var body:(BulkUpdateAction|BulkUpdateDocument)[] = [];
        for(let item of items) {

            var itemId = item[tableMapping.idAttribute];
            if(tableMapping.maintainItemMap) {
                itemMap[itemId] = item;
            }

            if(_.isFunction(tableMapping.itemModificationFunction)) {
                item = tableMapping.itemModificationFunction.apply(this, [item, this.tableItemMap]);
            }

            var action = <BulkUpdateAction>{ 
                update:  { 
                    _index: this.config.esIndex, 
                    _type: tableMapping.type, 
                    _id: itemId 
                } 
            };

            // By default, our update is just a doc update.
            var document = <BulkUpdateDocument>{ 
                doc: item, 
                doc_as_upsert: true 
            };
            
            // If a versionAttribute is specified, we use a conditional update to
            // make sure we aren't overwriting with an older version.
            if(tableMapping.versionAttribute) {
                document = {
                    script: {
                        inline: "if (ctx._source." + tableMapping.versionAttribute + " < params.doc." + tableMapping.versionAttribute + ") { ctx._source = params.doc } else { ctx.op = 'none' }",
                        params: {
                            doc: item
                        }
                    },
                    upsert: item
                };
            }

            // If a parent attribute is specified, we make sure and set that here.
            if(tableMapping.parentAttribute) {
                action.update.parent = item[tableMapping.parentAttribute];
            }

            body.push( action, document );
        }

        // Perform bulk update to ES.
        let bulkUpdateResult = await this.esClient.bulk({ body: body });
        if(bulkUpdateResult.errors == true) {
            bulkUpdateResult.items.forEach((resultItem, resultItemIndex) => {
                if(resultItem.update.status != 200 && resultItem.update.status != 201) {
                    var updateAction = body[(resultItemIndex*2)];
                    var updateBody = body[(resultItemIndex*2)+1];
                    console.log(JSON.stringify({
                        action: updateAction,
                        body: updateBody,
                        response: resultItem
                    },null,4));
                }
            });
            throw(new Error('Errors updating items.'));
        }
        else {
            return bulkUpdateResult;
        }
    }

    private async getNextPageOfItems(tableMapping:ProvisionerTableMapping, startKey?:string) {
        console.log('Retrieving page (' + tableMapping.currentPage + ') of items from DDB.');

        let ddbResult = await ddb.scan(
            tableMapping.table, 
            undefined,
            undefined,
            startKey);

        //console.log(ddbResult);
        console.log('Retrieved page ' + tableMapping.currentPage + ', ' + ddbResult.Items.length + ' items, bulk loading to ES...');
        tableMapping.currentPage++;
        
        try {
            await this.bulkUpdateItems(ddbResult.Items, tableMapping);
        }
        catch(error) {
            console.error('Unable to complete loading of events: ' + error.message);
            console.error(error.stack);
        }

        if( (!_.isNumber(tableMapping.ddbPageLimit) || tableMapping.currentPage < tableMapping.ddbPageLimit) && ddbResult.LastEvaluatedKey) {
            return this.getNextPageOfItems(tableMapping, ddbResult.LastEvaluatedKey);
        }
    }

}