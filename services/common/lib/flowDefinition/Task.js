var Promise = require('bluebird');
var _ = require('lodash');

function Task(flow, taskConfig, input) {
    this.flow = flow;
    this.taskConfig = taskConfig;
    this.input = input;
}

Task.prototype.run = function() {
    console.log('Running flow task: ' + this.taskConfig.taskName);
    
    var taskRunner = this.taskFactory();

    if( taskRunner ) {
        if(!_.isFunction(taskRunner.run))
            return Promise.reject(new Error('Task runner does not have a run method.'));
        
        if( !this.configHasPropertiesSet(taskRunner.requiredConfigProperties) )
            return Promise.reject(new Error('Task config not in appropriate format: ' + JSON.stringify(this.taskConfig)));
        
        return taskRunner.run.call(this);
    }
    else {
        return Promise.reject(new Error('Unable to generate task runner for task type: ' + JSON.stringify(this.taskConfig)));
    }
}

Task.prototype.configHasPropertiesSet = function(properties) {
    for( var i = 0; i < properties.length; i++ ) {
        var propertyName = properties[i];
        if( !this.taskConfig.hasOwnProperty(propertyName) || this.taskConfig[propertyName] === null ||
            this.taskConfig[propertyName] === "" )
            return false;
    }
    return true;
}

// Returns the appropriate task (function) based on the task config that
// is passed in.
Task.prototype.taskFactory = function() {
    
    var taskType = this.taskConfig.taskType;
    if(!taskType || !/^(?:[a-z]+\.)+[a-zA-Z]+$/.test(taskType)) {
        console.log('Unable to load specified task, task not defined or in improper format: ' + taskType);   
        return null;
    }

    try {
        var runner = require('./tasks/' + taskType.split(".").join("/") + '.js');
        return runner;
    }
    catch(error) {
        console.log('Unable to load specified task: ' + taskType);
        return null;
    }
}

Task.run = function(flow, taskConfig, taskInput) {
    console.log('Task.run: Creating new task: ' + JSON.stringify({
       taskConfig: taskConfig,
       taskInput: taskInput 
    }));
    var task = new Task(flow, taskConfig, taskInput);
    return task.run();
}

module.exports = Task;