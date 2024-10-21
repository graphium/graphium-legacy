import {Index,Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId} from "typeorm";


@Entity("flyway_schema_history",{schema:"graphium"})
export class FlywaySchemaHistory {

    @Column("integer",{ 
        nullable:false,
        primary:true,
        name:"installed_rank"
        })
    installedRank:number;
        

    @Column("character varying",{ 
        nullable:true,
        length:50,
        name:"version"
        })
    version:string | null;
        

    @Column("character varying",{ 
        nullable:false,
        length:200,
        name:"description"
        })
    description:string;
        

    @Column("character varying",{ 
        nullable:false,
        length:20,
        name:"type"
        })
    type:string;
        

    @Column("character varying",{ 
        nullable:false,
        length:1000,
        name:"script"
        })
    script:string;
        

    @Column("integer",{ 
        nullable:true,
        name:"checksum"
        })
    checksum:number | null;
        

    @Column("character varying",{ 
        nullable:false,
        length:100,
        name:"installed_by"
        })
    installedBy:string;
        

    @Column("timestamp without time zone",{ 
        nullable:false,
        default:"now()",
        name:"installed_on"
        })
    installedOn:Date;
        

    @Column("integer",{ 
        nullable:false,
        name:"execution_time"
        })
    executionTime:number;
        

    @Column("boolean",{ 
        nullable:false,
        name:"success"
        })
    success:boolean;
        
}
