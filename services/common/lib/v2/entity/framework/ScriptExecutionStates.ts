import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";
import {ScriptExecutionAttempt} from "./ScriptExecutionAttempt";


@Entity("script_execution_states",{schema:"graphium"})
export class ScriptExecutionStates {

    @Column("bigint",{ 
        nullable:false,
        primary:true,
        name:"execution_state_id"
        })
    executionStateId:string;
        

    @Column("text",{ 
        nullable:false,
        name:"execution_state_code"
        })
    executionStateCode:string;
        

    @Column("text",{ 
        nullable:false,
        name:"execution_state_title"
        })
    executionStateTitle:string;
        

    @Column("text",{ 
        nullable:true,
        name:"execution_state_description"
        })
    executionStateDescription:string | null;
        

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
        

   
    @OneToOne(type=>ScriptExecutionAttempt, ScriptExecutionAttempt=>ScriptExecutionAttempt.executionState)
    scriptExecutionAttempt:ScriptExecutionAttempt | null;

}
