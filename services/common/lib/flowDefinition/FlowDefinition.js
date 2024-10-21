var _ = require('lodash');
var Task = require('./Task.js');
var yaml = require('js-yaml');

function FlowDefinition(config) {
    this.flowConfig = parseConfig(config);
    this.variables = {};
    this.message = null;
}

var isFlowConfigValid = function(config)
{
    return config.hasOwnProperty('flowName') &&
        config.hasOwnProperty('streamType') &&
        config.hasOwnProperty('messageTypes') &&
        config.hasOwnProperty('flow') &&
        _.isArray(config.flow);
}

var parseConfig = function(config)
{
    var c = null;
    if( _.isString(config) ) {
        try {
            c = yaml.safeLoad(config);
        }
        catch(error) {
            throw new Error('Unable to parse flow config.');
        }
    }
    else if( _.isPlainObject(config) ) {
        c = config;
    }
    else {
        throw new Error('Unable to parse flow config.');
    }
    
    if( !c || !isFlowConfigValid(c) )
        throw new Error('Flow config is invalid format.')
        
    return c;
}

// Executes the flow for the specified content and
// returns a fulfillable promise.
FlowDefinition.prototype.execute = function(messageContent) {
    console.log('Flow.execute');
    
    this.message = messageContent;
    
    // Execute the initial task specified in the flow. By default
    // a flow is a 'series' of tasks and we treat it as such and
    // wrap it in a series task to run it.
    var initialTasks = this.flowConfig.flow;
    var initialTaskConfig = {
        taskType: "control.series",
        tasks: initialTasks,
        taskName: "Executing flow tasks."
    }
    
    return Task.run(this, initialTaskConfig, this.message);
}

module.exports = FlowDefinition;