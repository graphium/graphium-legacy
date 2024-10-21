import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {FlowScriptTemplateOrg} from "./FlowScriptTemplateOrg";
import {FlowScriptTemplateHistory} from "./FlowScriptTemplateHistory";
import {FlowScript} from "./FlowScript";
import { FlowScriptType } from "./FlowScriptType";
import { FlowScriptHistory } from "./FlowScriptHistory";


@Entity("flow_script_template",{schema:"graphium"})
export class FlowScriptTemplate {

    @Column("uuid",{ 
        nullable:false,
        primary:true,
        default:"uuid_generate_v4()",
        name:"flow_script_template_guid"
        })
    flowScriptTemplateGuid:string;
        

    @Column("integer",{ 
        nullable:false,
        name:"flow_script_template_version"
        })
    flowScriptTemplateVersion:number;
        

    @Column("text",{ 
        nullable:false,
        name:"script_content"
        })
    scriptContent:string;
    

    @Column("text",{ 
        nullable:false,
        name:"default_handler"
        })
    defaultHandler:string;


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
        

    @ManyToOne(type=>FlowScriptType, FlowScriptType=>FlowScriptType.flowScriptTemplates,{  nullable:false, eager: true })
    @JoinColumn({ name:'flow_script_type_id'})
    flowScriptType:FlowScriptType;
        

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
        

    @Column("timestamp with time zone",{ 
        nullable:false,
        default:"now()",
        name:"updated_at"
        })
    updatedAt:Date;
        

    @Column("boolean",{ 
        nullable:false,
        default:"(0)::boolean",
        name:"system_global"
        })
    systemGlobal:boolean;        

   
    @OneToMany(type=>FlowScriptTemplateOrg, FlowScriptTemplateOrg=>FlowScriptTemplateOrg.flowScriptTemplate, { eager: true })
    flowScriptTemplateOrgs:FlowScriptTemplateOrg[] | null;


    @OneToMany(type=>FlowScriptTemplateHistory, FlowScriptTemplateHistory=>FlowScriptTemplateHistory.template)
    histories:FlowScriptTemplateHistory[];

   
    @OneToMany(type=>FlowScript, FlowScript=>FlowScript.flowScriptTemplate)
    flowScripts:FlowScript[];


    @OneToMany(type=>FlowScriptHistory, FlowScriptHistory=>FlowScriptHistory.flowScriptTemplate)
    flowScriptHistories:FlowScriptHistory[];
}
