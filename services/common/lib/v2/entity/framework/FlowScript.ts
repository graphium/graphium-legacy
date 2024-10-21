import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {FlowScriptTemplate} from "./FlowScriptTemplate";
import {FlowScriptType} from "./FlowScriptType";
import {FlowScriptHistory} from "./FlowScriptHistory";
import {ScheduledJob} from "./ScheduledJob";

@Entity("flow_script",{schema:"graphium"})
export class FlowScript {

    @Column("uuid",{ 
        nullable:false,
        primary:true,
        default:"uuid_generate_v4()",
        name:"flow_script_guid"
        })
    flowScriptGuid:string;
        
    @Column("integer",{ 
        nullable:false,
        default:"1",
        name:"flow_script_version"
        })
    flowScriptVersion:number;
   
    @ManyToOne(type=>FlowScriptTemplate, FlowScriptTemplate=>FlowScriptTemplate.flowScripts,{ eager: true })
    @JoinColumn({ name:'flow_script_template_guid'})
    flowScriptTemplate:FlowScriptTemplate | null;
   
    @ManyToOne(type=>FlowScriptType, FlowScriptType=>FlowScriptType.flowScripts,{  nullable:false, eager: true })
    @JoinColumn({ name:'flow_script_type_id'})
    flowScriptType:FlowScriptType | null;

    @Column("text",{ 
        nullable:false,
        name:"flow_script_title"
        })
    flowScriptTitle:string;        

    @Column("text",{ 
        nullable:true,
        name:"flow_script_description"
        })
    flowScriptDescription:string | null;

    @Column("text",{ 
        nullable:true,
        name:"script_content"
        })
    scriptContent:string | null;

    @Column("text",{ 
        nullable:true,
        name:"default_handler"
        })
    defaultHandler:string | null;
        
    @Column("jsonb",{ 
        nullable:false,
        default:"'{}'::jsonb",
        name:"config_params"
        })
    configParams:Object;

    @Column("jsonb",{ 
        nullable:false,
        default:"'{}'::jsonb",
        name:"config_values"
        })
    configValues:Object;

    @Column("integer",{ 
        nullable:true,
        name:"timeout_seconds"
        })
    timeoutSeconds:number | null;

    @Column("integer",{ 
        nullable:true,
        name:"max_retries"
        })
    maxRetries:number | null;

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
   
    @OneToMany(type=>FlowScriptHistory, FlowScriptHistory=>FlowScriptHistory.flowScript)
    flowScriptHistories:FlowScriptHistory[];
   
    @OneToMany(type=>ScheduledJob, ScheduledJob=>ScheduledJob.flowScript)
    scheduledJobs:ScheduledJob[];
}
