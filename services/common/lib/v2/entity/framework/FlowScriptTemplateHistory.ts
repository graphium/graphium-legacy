import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {FlowScriptTemplate} from "./FlowScriptTemplate";
import {FlowScriptType} from "./FlowScriptType";
import {ScriptExecutionAttempt} from "./ScriptExecutionAttempt";


@Entity("flow_script_template_history",{schema:"graphium"})
export class FlowScriptTemplateHistory {

    @Column("bigint",{ nullable:false, primary:true, name:"flow_script_template_history_id" })
    flowScriptTemplateHistoryId:string;
    
    @ManyToOne(type=>FlowScriptTemplate, FlowScriptTemplate=>FlowScriptTemplate.histories,{ nullable:false, eager:true })
    @JoinColumn({ name:'flow_script_template_guid'})
    template:FlowScriptTemplate | null;

    @Column("integer",{ 
        nullable:false,
        name:"flow_script_template_version"
        })
    flowScriptTemplateVersion:number;
        
    @ManyToOne(type=>FlowScriptType, FlowScriptType=>FlowScriptType.flowScriptTemplateHistories,{ nullable:false, eager: true })
    @JoinColumn({ name:'flow_script_type_id'})
    flowScriptType:FlowScriptType | null;

    @Column("text",{ 
        nullable:false,
        name:"script_content"
        })
    scriptContent:string;
        

    @Column("text",{ 
        nullable:false,
        name:"flow_script_template_code"
        })
    flowScriptTemplateCode:string;
        

    @Column("text",{ 
        nullable:false,
        name:"flow_script_template_title"
        })
    flowScriptTemplateTitle:string;
        

    @Column("text",{ 
        nullable:true,
        name:"flow_script_template_description"
        })
    flowScriptTemplateDescription:string | null;
        

    @Column("jsonb",{ 
        nullable:false,
        default:"'{}'::jsonb",
        name:"config_params"
        })
    configParams:Object;
        

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
        

   
    @OneToMany(type=>ScriptExecutionAttempt, ScriptExecutionAttempt=>ScriptExecutionAttempt.flowScriptTemplateHistory)
    execAttempts:ScriptExecutionAttempt[];
    
}
