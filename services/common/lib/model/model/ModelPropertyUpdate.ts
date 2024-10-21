import { RepeatableBitmapUpdate } from "./RepeatableBitmapUpdate";

export interface ModelPropertyUpdate {
    propertyName:string;
    pageId?:number;
    propertySequence?:number;
    fieldValue:string|number|boolean|RepeatableBitmapUpdate|null;
    formValid: boolean;
    percentComplete:number;
    jsonPointer?: string;
    jsonIndex?: number;
    jsonPropertyType?: string;
    inputName?: string;
}