import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {ScheduledJob} from "./ScheduledJob";


@Entity("job_schedule",{schema:"graphium"})
export class JobSchedule {

    @Column("bigint",{ 
        nullable:false,
        primary:true,
        name:"job_schedule_id"
        })
    jobScheduleId:string;
        

    @Column("text",{ 
        nullable:false,
        name:"job_schedule_code"
        })
    jobScheduleCode:string;
        

    @Column("text",{ 
        nullable:false,
        name:"job_schedule_title"
        })
    jobScheduleTitle:string;
        

    @Column("text",{ 
        nullable:true,
        name:"job_schedule_description"
        })
    jobScheduleDescription:string | null;
        

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
        

   
    @OneToMany(type=>ScheduledJob, ScheduledJob=>ScheduledJob.jobSchedule)
    scheduledJobs:ScheduledJob[];
    
}
