import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {ScheduledJob} from "./ScheduledJob";
import {ScheduledJobState} from "./ScheduledJobState";
import {ScriptExecutionAttempt} from "./ScriptExecutionAttempt";


@Entity("scheduled_job_run",{schema:"graphium"})
export class ScheduledJobRun {

    @Column("uuid",{ 
        nullable:false,
        primary:true,
        default:"uuid_generate_v4()",
        name:"scheduled_job_run_guid"
        })
    scheduledJobRunGuid:string;
        

   
    @ManyToOne(type=>ScheduledJob, ScheduledJob=>ScheduledJob.scheduledJobRuns,{  nullable:false, })
    @JoinColumn({ name:'scheduled_job_guid'})
    scheduledJob:ScheduledJob | null;


    @Column("timestamp with time zone",{ 
        nullable:true,
        name:"scheduled_datetime"
        })
    scheduledDatetime:Date | null;
        

    @Column("integer",{ 
        nullable:false,
        default:"0",
        name:"attempt_count"
        })
    attemptCount:number;
        

   
    @ManyToOne(type=>ScheduledJobState, ScheduledJobState=>ScheduledJobState.scheduledJobRuns,{  nullable:false, })
    @JoinColumn({ name:'job_state_id'})
    jobState:ScheduledJobState | null;


   
    @ManyToOne(type=>ScriptExecutionAttempt, ScriptExecutionAttempt=>ScriptExecutionAttempt.scheduledJobRuns,{  nullable:false, })
    @JoinColumn({ name:'current_script_execution_attempt_guid'})
    currentScriptExecutionAttempt:ScriptExecutionAttempt | null;


    @Column("jsonb",{ 
        nullable:false,
        default:"'[]'::jsonb",
        name:"job_state_transitions"
        })
    jobStateTransitions:Object;
        

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
        
}
