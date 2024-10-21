import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {FlowScript} from "./FlowScript";
import {ScriptExecutionAttempt} from "./ScriptExecutionAttempt";
import { FlowScriptType } from "./FlowScriptType";
import { FlowScriptTemplate } from "./FlowScriptTemplate";


@Entity("flow_script_history",{schema:"graphium"})
export class FlowScriptHistory {

    @Column("bigint",{ 
        nullable:false,
        primary:true,
        name:"flow_script_history_id"
        })
    flowScriptHistoryId:string;
        

   
    @ManyToOne(type=>FlowScript, FlowScript=>FlowScript.flowScriptHistories,{  nullable:false, })
    @JoinColumn({ name:'flow_script_guid'})
    flowScript:FlowScript | null;


    @Column("integer",{ 
        nullable:false,
        name:"flow_script_version"
        })
    flowScriptVersion:number;
        
 
    @ManyToOne(type=>FlowScriptTemplate, FlowScriptTemplate=>FlowScriptTemplate.flowScriptHistories,{ eager: true })
    @JoinColumn({ name:'flow_script_template_guid' })
    flowScriptTemplate:FlowScriptTemplate | null;
        

    @ManyToOne(type=>FlowScriptType, FlowScriptType=>FlowScriptType.flowScriptHistories,{  nullable:false, eager:true })
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
        name:"config_params"
        })
    configParams:Object;
        

    @Column("jsonb",{ 
        nullable:false,
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
        

   
    @OneToOne(type=>ScriptExecutionAttempt, ScriptExecutionAttempt=>ScriptExecutionAttempt.flowScriptHistory)
    scriptExecutionAttempt:ScriptExecutionAttempt | null;

}
