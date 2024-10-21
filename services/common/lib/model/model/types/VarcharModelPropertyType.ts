import { ModelPropertyType } from "../ModelPropertyType";
import { DefaultModelPropertyType } from "./DefaultModelPropertyType";

export interface VarcharModelPropertyType extends DefaultModelPropertyType {
    typeName: 'varchar';
    length: number;
}
