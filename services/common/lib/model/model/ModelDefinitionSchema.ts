import { ModelPropertyDefinitionSchema } from "./ModelPropertyDefinitionSchema";
import * as xml2js from 'xml2js';
import { ModelPropertyType } from "./ModelPropertyType";


export class ModelDefinitionSchema {
    // NOOP valueLists: ModelValueList[];

    private parsedContent:any;
    private parsedProperties:ModelPropertyDefinitionSchema[];
    private hasContent:boolean = false;

    constructor(private modelDefinitionContent:string) {
    }
    
    async parseModelDefinitionContent() {
        let parseOptions = <xml2js.OptionsV2>{
            explicitArray: false,
            explicitRoot: false,
            mergeAttrs: true
        };
        this.parsedContent = await xml2js.parseStringPromise(this.modelDefinitionContent, parseOptions);
        
        this.parsedProperties = [];
        for(let parsedProperty of this.parsedContent.property) {
            this.parsedProperties.push(this.parseProperty(parsedProperty));
        }

        this.hasContent = true;
    }

    get name():string {
        if(!this.hasContent) throw new Error('Unable to access schema information, content has not been parsed.');
        return this.parsedContent.name;
    }

    get title():string {
        if(!this.hasContent) throw new Error('Unable to access schema information, content has not been parsed.');
        return this.parsedContent.title;
    }

    get description():string {
        if(!this.hasContent) throw new Error('Unable to access schema information, content has not been parsed.');
        return this.parsedContent.description;
    }

    get properties():ModelPropertyDefinitionSchema[] {
        if(!this.hasContent) throw new Error('Unable to access schema information, content has not been parsed.');
        return this.parsedProperties;
    }

    private parseProperty(parsedProperty:any):ModelPropertyDefinitionSchema {
        return new ModelPropertyDefinitionSchema({
            name: parsedProperty.name,
            title: parsedProperty.title,
            description: parsedProperty.description,
            isRepeatable: parsedProperty.isRepeatable === 'true',
            type: this.parsePropertyType(parsedProperty.type)
        });
    }

    private parsePropertyType(parsedPropertyType:any):ModelPropertyType {
        let typeName = Object.keys(parsedPropertyType)[0];
        return {
            ... { typeName: typeName },
            ... parsedPropertyType[typeName]
        }
    }

    getPropertyByName(propertyName:string):ModelPropertyDefinitionSchema|null {
        if(!this.hasContent) throw new Error('Unable to access schema information, content has not been parsed.');

        return this.parsedProperties.find(p => p.name == propertyName);
    }

    getPropertyType(propertyName:string):string|null {
        if(!this.hasContent) throw new Error('Unable to access schema information, content has not been parsed.');

        let p = this.parsedProperties.find(p => p.name == propertyName);
        return p !== null ? p.type.typeName : null;
    }

    toJSON(): any {
        return {
            name: this.name,
            title: this.title,
            description: this.description,
            properties: this.properties
        }
    };
}

