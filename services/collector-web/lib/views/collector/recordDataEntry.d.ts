
declare function setInputIfEmpty(inputName: string, value: string): void;
declare function dataEntryValidator(validator: string): (value: string) => string;
declare function dataEntryDateValidator(): (value: string) => string;
declare function requiredIfFieldSet(field: string, message?: string): (value: string) => string;
declare function requiredIfFieldSetTo(field: string, value: string, message?: string): (value: string) => string;
declare function stringValidator(): (value: string) => string;
declare function validDateIfFieldSetTo(field: string, value: string): (value: string) => string;
declare function validTimeIfFieldSetTo(field: string, value: string): (value: string) => string;
declare function dataEntryTimeValidator(): (value: string) => string;
declare function validDateIfFieldSet(field: string): (value: string) => string;
declare function validTimeIfFieldSet(field: string): (value: string) => string;
declare function validDateIfFieldSetTo(field: string, value: string): (value: string) => string;
declare function validTimeIfFieldSetTo(field: string, value: string): (value: string) => string;
declare function validateIfFieldSetTo(field: string, value: string): (value: string) => string;
declare function requiredIfExpressionTrue(expression: (formValues: any) => boolean): (value: string) => string;
declare function validDateIfFieldNotNull(field: string): (value: string) => string;
declare function stringValidator(): (value: string) => string;
declare function decimalValidator(): (value: string) => string;
declare function validTimeIfFieldNotNull(field: string): (value: string) => string;
declare function validSome(validators: any[]): (value: string) => string;
declare function validIfFieldSetTo(field: string, value: string): (value: string) => string;
declare function validateValueNotNullIfFieldSetTo(field: string): (value: string) => string;

declare var importBatch: any;
declare var previousRecord: any;
declare var importBatchRecord: any;
declare var _: lodash.LoDashStatic;