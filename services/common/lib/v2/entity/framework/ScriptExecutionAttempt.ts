import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {FlowScriptHistory} from "./FlowScriptHistory";
import {FlowScriptTemplateHistory} from "./FlowScriptTemplateHistory";
import {ScriptExecutionStates} from "./ScriptExecutionStates";
import {ScheduledJobRun} from "./ScheduledJobRun";


@Entity("script_execution_attempt",{schema:"graphium"})
export class ScriptExecutionAttempt {

    @Column("uuid",{ 
        nullable:false,
        primary:true,
        default:"uuid_generate_v4()",
        name:"script_execution_attempt_guid"
        })
    scriptExecutionAttemptGuid:string;
        

   
    @OneToOne(type=>FlowScriptHistory, FlowScriptHistory=>FlowScriptHistory.scriptExecutionAttempt,{  nullable:false, })
    @JoinColumn({ name:'flow_script_history_id'})
    flowScriptHistory:FlowScriptHistory | null;


   
    @ManyToOne(type=>FlowScriptTemplateHistory, FlowScriptTemplateHistory=>FlowScriptTemplateHistory.execAttempts,{  })
    @JoinColumn({ name:'flow_script_template_history_id'})
    flowScriptTemplateHistory:FlowScriptTemplateHistory | null;


   
    @OneToOne(type=>ScriptExecutionStates, ScriptExecutionStates=>ScriptExecutionStates.scriptExecutionAttempt,{  nullable:false, })
    @JoinColumn({ name:'execution_state_id'})
    executionState:ScriptExecutionStates | null;


    @Column("jsonb",{ 
        nullable:false,
        default:"'[]'::jsonb",
        name:"execution_state_transitions"
        })
    executionStateTransitions:Object;

    @Column("timestamp with time zone",{ 
        nullable:false,
        default:"now()",
        name:"created_at"
        })
    createdAt:Date;
        

    @Column("timestamp with time zone",{ 
        nullable:false,
        default:"now()",
        name:"updated_at"
        })
    updatedAt:Date;
        

   
    @OneToMany(type=>ScheduledJobRun, ScheduledJobRun=>ScheduledJobRun.currentScriptExecutionAttempt)
    scheduledJobRuns:ScheduledJobRun[];
    
}
