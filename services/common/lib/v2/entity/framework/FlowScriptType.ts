import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {FlowScriptTemplateHistory} from "./FlowScriptTemplateHistory";
import {FlowScript} from "./FlowScript";
import { FlowScriptHistory } from "./FlowScriptHistory";
import { FlowScriptTemplate } from "./FlowScriptTemplate";


@Entity("flow_script_type",{schema:"graphium"})
export class FlowScriptType {

    @Column("bigint",{ 
        nullable:false,
        primary:true,
        name:"flow_script_type_id"
        })
    flowScriptTypeId:string;
        

    @Column("text",{ 
        nullable:false,
        name:"flow_script_type_code"
        })
    flowScriptTypeCode:string;
        

    @Column("text",{ 
        nullable:false,
        name:"flow_script_type_title"
        })
    flowScriptTypeTitle:string;
        

    @Column("text",{ 
        nullable:true,
        name:"flow_script_type_description"
        })
    flowScriptTypeDescription:string | null;
        

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
    
    
    @OneToMany(type=>FlowScriptTemplate, FlowScriptTemplate=>FlowScriptTemplate.flowScriptType)
    flowScriptTemplates:FlowScriptTemplate[];

   
    @OneToMany(type=>FlowScriptTemplateHistory, FlowScriptTemplateHistory=>FlowScriptTemplateHistory.flowScriptType)
    flowScriptTemplateHistories:FlowScriptTemplateHistory[];
    
   
    @OneToMany(type=>FlowScript, FlowScript=>FlowScript.flowScriptType)
    flowScripts:FlowScript[];
    

    @OneToMany(type=>FlowScriptHistory, FlowScriptHistory=>FlowScriptHistory.flowScriptType)
    flowScriptHistories:FlowScript[];


}
