import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {FlowScriptTemplate} from "./FlowScriptTemplate";


@Entity("flow_script_template_orgs",{schema:"graphium"})
export class FlowScriptTemplateOrg {

    @Column("bigint",{ 
        nullable:false,
        primary:true,
        name:"flow_script_template_org_id"
        })
    flowScriptTemplateOrgId:string;
        

   
    @OneToOne(type=>FlowScriptTemplate, FlowScriptTemplate=>FlowScriptTemplate.flowScriptTemplateOrgs,{  nullable:false, })
    @JoinColumn({ name:'flow_script_template_guid'})
    flowScriptTemplate:FlowScriptTemplate | null;


    @Column("text",{ 
        nullable:false,
        name:"org_name_internal"
        })
    orgNameInternal:string;
        

    @Column("timestamp with time zone",{ 
        nullable:false,
        default:"now()",
        name:"created_at"
        })
    createdAt:Date;
        
}
