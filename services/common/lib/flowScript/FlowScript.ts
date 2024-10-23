var _ = require('lodash');
var graphium = require('@graphiumhealth/graphium-sdk');
var fork = require('child_process').fork;
var winston = require('winston');
var pako = require('pako');

import * as Bluebird from 'bluebird';
import * as cp from 'child_process';
import FlowScriptError from './FlowScriptError';
import Flow from '../model/flow/Flow';
import * as ts from 'typescript';
import { EnvironmentConfig } from '../../lib/config/EnvironmentConfig';

export class FlowScript {
    
    private _workerProcess:cp.ChildProcess;
    private _runPromise:Bluebird<{scriptResult:any, scriptDuration:number}>;
    private _runPromiseResolve:Function;
    private _runPromiseReject:Function;
    private _timeoutId:NodeJS.Timer;
    private _instanceId;
    private _scriptStartTime:number;

    constructor(readonly flow:Flow, readonly messageInstance:any, readonly transactionId?:string) {
        this.validateConfig();
    }

    private log(level:'info'|'error', message:string, data?:{}) {
        if(EnvironmentConfig.environment == 'development') {
            console.log(message);
        }
        else {
            winston.log(level, message, data);
        }
    }

    private validateConfig():boolean {
        if( _.isPlainObject(this.messageInstance) &&
            _.isPlainObject(this.flow) )
            return true;
            
        throw new Error('FlowScript config is not in appropriate format.');
    }

    private _contextSucceed(result:any) {
        if(this._runPromise.isPending()) {
            //console.log('(FlowScript['+this._instanceId+'].contextSucceed) Resolving promise. ');
            
            var formattedResult = {
                scriptResult: result,
                scriptDuration: Date.now() - this._scriptStartTime
            }
            this._runPromiseResolve(formattedResult);
        }
        this._killChild();
    }

    private _contextFail(error:Error) {
        if(this._runPromise.isPending()) {
            //console.log('(FlowScript['+this._instanceId+'].contextFail) Rejecting promise.');
            this._runPromiseReject(error);
        }
        
        this._killChild();
    }

    private _killChild() {
        if( this._workerProcess ) {
            this.log('info', 'Flow worker killing child.', {
                eventType: 'FLOW_WORKER_KILLCHILD',
                methodClass: 'FlowScript',
                methodName: '_killChild', 
                messageInstanceGuid:this.messageInstance.messageInstanceGuid,
                messageRequestGuid: this.messageInstance.messageRequestGuid,
                flowGuid: this.flow.flowGuid,
                flowName: this.flow.flowName,
                transactionId: this.transactionId
            });
            
            this._workerProcess.kill('SIGKILL');
            this._workerProcess = null;
            clearTimeout(this._timeoutId);
        }
    }

    private _onWorkerMessage(message) {
        //console.log('(FlowScript['+this._instanceId+'].onWorkerMessage) ' + JSON.stringify(message));
        this.log('info', 'Flow worker message,', {
            eventType: 'FLOW_WORKER_MESSAGE',
            methodClass: 'FlowScript',
            methodName: '_onWorkerMessage', 
            messageInstanceGuid:this.messageInstance.messageInstanceGuid,
            messageRequestGuid: this.messageInstance.messageRequestGuid,
            flowGuid: this.flow.flowGuid,
            flowName: this.flow.flowName,
            transactionId: this.transactionId,
            workerMessage: message
        });
        switch(message.type) {
            case 'RUN_SUCCESS': {
                this._contextSucceed(message.result); 
                break;
            }
            case 'RUN_FAILURE': {
                var error:FlowScriptError = new FlowScriptError(message);
                this._contextFail(error); 
                break;
            }
            default:
                this.log('error','Received unknown message from flow script worker: ' + message.type);
                break;
        }
    }

    private _onWorkerExit(code,signal) {
        this.log('info', 'Flow worker exit.', {
            eventType: 'FLOW_WORKER_EXIT',
            methodClass: 'FlowScript',
            methodName: '_onWorkerExit', 
            messageInstanceGuid:this.messageInstance.messageInstanceGuid,
            messageRequestGuid: this.messageInstance.messageRequestGuid,
            flowGuid: this.flow.flowGuid,
            flowName: this.flow.flowName,
            transactionId: this.transactionId,
            exitCode: code,
            exitSignal: signal
            //stack: new Error().stack
        });
        this._contextFail(new Error('Child process exited with code ' + code + ' signal ' + signal));
    };

    private compileTypescript(source:string):string {
       let result = ts.transpile(source,
            {
                noImplicitAny: false,
                target: ts.ScriptTarget.ES5,
                module: ts.ModuleKind.CommonJS,
                sourceMap: false,
                allowSyntheticDefaultImports: true
            }
        );
        return result;
    }

    public run():PromiseLike<{scriptResult:any, scriptDuration:number}> {


        if(this.flow.scriptLanguage == 'typescript') {
            this.flow.flowContent = this.compileTypescript(this.flow.flowContent);
        }

        this.log('info', 'Running flow script.', {
            eventType: 'FLOW_SCRIPT_START',
            methodClass: 'FlowScript',
            methodName: 'run', 
            messageInstanceGuid:this.messageInstance.messageInstanceGuid,
            messageRequestGuid: this.messageInstance.messageRequestGuid,
            flowGuid: this.flow.flowGuid,
            flowName: this.flow.flowName,
            transactionId: this.transactionId
        });
        
        if( this._timeoutId != null || this._runPromise != null )
            return;
            
        var _this = this;
        
        this._runPromise = new Bluebird(function(resolve,reject) {
            _this._runPromiseResolve = resolve;
            _this._runPromiseReject = reject;
        });
        
        var scriptTimeout = _.isInteger(this.flow.timeout) ? 
                                Math.min(this.flow.timeout, 1200 ) : 5;
        
        var forkOptions:cp.ForkOptions = {
            cwd: process.env.WORKER_CWD || './',
            // Need to figure out a better way for the worker to 
            // access secretes but to protect them from the script it is executing.
            env: process.env,
            silent: true
        };

        if(EnvironmentConfig.environment == 'development') {
            forkOptions.execArgv = ['--debug=5555'];
        }
        else {
            forkOptions.execArgv = ['--no-deprecation'];
        }
        
        var workerPath = process.env.WORKER_PATH || (__dirname + '/flowScriptWorker.js');
        
        this._scriptStartTime = Date.now();
        this._workerProcess = cp.fork(workerPath, [], forkOptions);
        this._workerProcess.on('message', function(message) { _this._onWorkerMessage.call(_this,message) });
        this._workerProcess.on('exit', function(code,signal) {
            _this.log('info', 'Flow Script Worker Close' , {
                methodClass: 'FlowScript',
                methodName: 'run', 
                eventType: 'FLOW_SCRIPT_WRKR_EXIT',
                messageInstanceGuid:_this.messageInstance.messageInstanceGuid,
                messageRequestGuid:_this.messageInstance.messageRequestGuid,
                code: code,
                signal: signal,
                flowGuid: _this.flow.flowGuid,
                flowName: _this.flow.flowName,
                transactionId: _this.transactionId
            }); 
        });
        this._workerProcess.on('close', function(code, signal) {
            _this.log('info', 'Flow Script Worker Close' , {
                methodClass: 'FlowScript',
                methodName: 'run', 
                eventType: 'FLOW_SCRIPT_WRKR_CLOSE',
                messageInstanceGuid:_this.messageInstance.messageInstanceGuid,
                messageRequestGuid:_this.messageInstance.messageRequestGuid,
                code: code,
                signal: signal,
                flowGuid: _this.flow.flowGuid,
                flowName: _this.flow.flowName,
                transactionId: _this.transactionId
            });
            _this._onWorkerExit.call(_this,code,signal); 
        });
        this._workerProcess.on('error', function(error) { 
            _this.log('error', 'Flow Script Worker Error: ' + error.message, {
                methodClass: 'FlowScript',
                methodName: 'run', 
                eventType: 'FLOW_SCRIPT_WRKR_ERROR',
                messageInstanceGuid:_this.messageInstance.messageInstanceGuid,
                messageRequestGuid:_this.messageInstance.messageRequestGuid,
                errorMessage: error.message,
                errorStack: error.stack,
                flowGuid: _this.flow.flowGuid,
                flowName: _this.flow.flowName,
                transactionId: _this.transactionId
            });
        });
        this._workerProcess.stdout.on('data', function(data) {
            _this.log('info', 'Flow Script Stdout: ' + data.toString(), {
                methodClass: 'FlowScript',
                methodName: 'run', 
                eventType: 'FLOW_SCRIPT_WRKR_STDOUT',
                messageInstanceGuid:_this.messageInstance.messageInstanceGuid,
                messageRequestGuid:_this.messageInstance.messageRequestGuid,
                logText: data.toString(),
                flowGuid: _this.flow.flowGuid,
                flowName: _this.flow.flowName,
                transactionId: _this.transactionId
            });
        });
        this._workerProcess.stderr.on('data', function(data) {
            if(data && data.toString() && data.toString().indexOf('String based operators are now deprecated') >= 0) {
                return;
            }
            
            _this.log('error', 'Flow Script Stderr: ' + data.toString(), {
                methodClass: 'FlowScript',
                methodName: 'run', 
                eventType: 'FLOW_SCRIPT_WRKR_STDERR',
                messageInstanceGuid:_this.messageInstance.messageInstanceGuid,
                messageRequestGuid:_this.messageInstance.messageRequestGuid,
                logText: data.toString(),
                flowGuid: _this.flow.flowGuid,
                flowName: _this.flow.flowName,
                transactionId: _this.transactionId
            });
        });
        
        this._timeoutId = setTimeout(function() {
            console.log('(FlowScript.timeout) Sending message to fail.');
            _this._contextFail.call(_this,new Error('Flow script timed out.'));
        }, (scriptTimeout+1)*1000);
        
        var messageInstanceCompressed = pako.deflate(JSON.stringify(this.messageInstance), {to:'string'});
        var configParametersCompressed = pako.deflate(JSON.stringify(EnvironmentConfig.getParameters()), {to:'string'});

        this._workerProcess.send({
            type: 'RUN',
            flow: this.flow,
            messageInstanceCompressed: messageInstanceCompressed,
            configParametersCompressed: configParametersCompressed
        });
        
        return this._runPromise;
    }

}

export default FlowScript;