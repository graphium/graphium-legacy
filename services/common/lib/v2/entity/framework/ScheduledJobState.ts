import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {ScheduledJobRun} from "./ScheduledJobRun";


@Entity("scheduled_job_state",{schema:"graphium"})
export class ScheduledJobState {

    @Column("bigint",{ 
        nullable:false,
        primary:true,
        name:"scheduled_job_state_id"
        })
    scheduledJobStateId:string;
        

    @Column("text",{ 
        nullable:false,
        name:"scheduled_job_state_code"
        })
    scheduledJobStateCode:string;
        

    @Column("text",{ 
        nullable:false,
        name:"scheduled_job_state_title"
        })
    scheduledJobStateTitle:string;
        

    @Column("text",{ 
        nullable:true,
        name:"scheduled_job_state_description"
        })
    scheduledJobStateDescription:string | null;
        

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
        

   
    @OneToMany(type=>ScheduledJobRun, ScheduledJobRun=>ScheduledJobRun.jobState)
    scheduledJobRuns:ScheduledJobRun[];
    
}
