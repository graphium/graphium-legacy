import * as _ from 'lodash';

export function getItemFromTypes<T extends Object>(types: T[], idParameterName: keyof T, id:string): T {
    //console.log('getItemFromTypes: ');
    //console.log({types,idParameterName,id});

    let itemWithId:any = {};
    itemWithId[idParameterName] = id;

    if(!_.isArray(types) || types.length == 0) {
        return itemWithId;
    }

    let existingItem = types.find((t) => String(t[idParameterName]) == id);
    
    if(existingItem) {
        return existingItem;
    }

    return itemWithId;
}

export function getItemsFromTypes<T>(types: T[], idParameterName: keyof T, ids:string[] ): T[] {
    let items:T[] = [];

    if(types != null && types.length !== 0 && ids != null && ids.length !== 0) {
        for(let id of ids) {
            items.push(getItemFromTypes<T>(types, idParameterName, id));
        }
    }

    return items;
}
  