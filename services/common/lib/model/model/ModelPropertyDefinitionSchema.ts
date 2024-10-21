import { ModelPropertyType } from "./ModelPropertyType";
export class ModelPropertyDefinitionSchema {
    
    name: string;
    isRepeatable: boolean;
    // NOOP encrypt: boolean;
    title: string;
    description: string;
    type: ModelPropertyType;

    public constructor(init?:Partial<ModelPropertyDefinitionSchema>) {
        Object.assign(this, init);
    }

    toJSON():any {
        return {
            name: this.name,
            isRepeatable: this.isRepeatable,
            title: this.title,
            description: this.description,
            type: this.type.typeName
        }
    }
}
