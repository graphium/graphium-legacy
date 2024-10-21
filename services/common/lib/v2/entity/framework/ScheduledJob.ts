import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {JobSchedule} from "./JobSchedule";
import {FlowScript} from "./FlowScript";
import {ScheduledJobRun} from "./ScheduledJobRun";


@Entity("scheduled_job",{schema:"graphium"})
export class ScheduledJob {

    @Column("uuid",{ 
        nullable:false,
        primary:true,
        default:"uuid_generate_v4()",
        name:"scheduled_job_guid"
        })
    scheduledJobGuid:string;
        

   
    @ManyToOne(type=>JobSchedule, JobSchedule=>JobSchedule.scheduledJobs,{  nullable:false, })
    @JoinColumn({ name:'job_schedule_id'})
    jobSchedule:JobSchedule | null;


    @Column("text",{ 
        nullable:false,
        name:"organization_name_internal"
        })
    organizationNameInternal:string;
        

   
    @ManyToOne(type=>FlowScript, FlowScript=>FlowScript.scheduledJobs,{  nullable:false, })
    @JoinColumn({ name:'flow_script_guid'})
    flowScript:FlowScript | null;


    @Column("text",{ 
        nullable:false,
        name:"scheduled_job_title"
        })
    scheduledJobTitle:string;
        

    @Column("text",{ 
        nullable:true,
        name:"scheduled_job_description"
        })
    scheduledJobDescription:string | null;
        

    @Column("boolean",{ 
        nullable:false,
        default:"true",
        name:"active"
        })
    active:boolean;
        

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
        

   
    @OneToMany(type=>ScheduledJobRun, ScheduledJobRun=>ScheduledJobRun.scheduledJob)
    scheduledJobRuns:ScheduledJobRun[];
    
}
