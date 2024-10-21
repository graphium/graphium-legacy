export default class FlowScriptError extends Error {
    isScriptError = true;
    stack:string;
    result:any;

    constructor(scriptErrorResult:{error:{stack:string, message:string, result:any}}) {
        super(scriptErrorResult.error.message);
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain

        this.isScriptError = true;
        this.stack = scriptErrorResult.error.stack;
        this.result = scriptErrorResult.error.result;
    }
}