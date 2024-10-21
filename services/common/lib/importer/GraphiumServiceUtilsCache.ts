import * as storage from 'node-persist';
import * as _ from 'lodash';

export class GraphiumServiceUtilsCache<T = any> {
    transientStorage: { [s: string]: T };

    constructor(readonly enableDiskCaching: boolean) {
        if (this.enableDiskCaching) {

            let options = <storage.InitOptions>{
            };

            if(process.env.hasOwnProperty('AWS_EXECUTION_ENV') && process.env.AWS_EXECUTION_ENV.indexOf('AWS_Lambda_nodejs') == 0) {
                console.log('Enabling disk caching, detected Lambda and creating in /tmp');
                options.dir = '/tmp';
            }

            storage.initSync(options);
        }

        this.transientStorage = {};
    }

    removeItem(key:string):void {
        if (this.transientStorage) {
            this.transientStorage[key] = undefined;
        }

        if(storage.keys().indexOf(key)) {
            storage.removeItem(key);
        }
    }

    setItem(key:string, value:T, transient:boolean = false):void {
        if (transient || !this.enableDiskCaching) {
            this.transientStorage[key] = value;
        } else {
            storage.setItemSync(key, value);
        }
    }

    getItem(key:string):T {
        if (this.transientStorage.hasOwnProperty(key)) {
            return this.transientStorage[key];
        } else if (this.enableDiskCaching) {
            return storage.getItemSync(key);
        } else {
            return undefined;
        }
    }
}
