import {
    Index,
    Entity,
    PrimaryColumn,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    OneToMany,
    ManyToOne,
    ManyToMany,
    JoinColumn,
    JoinTable,
    RelationId,
} from 'typeorm';

@Entity('tag', { schema: 'graphium' })
export class Tag {
    @PrimaryGeneratedColumn('increment', {
        name: 'tag_id',
    })
    tagId?: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'catg_nm',
    })
    catgNm?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'tag_nm',
    })
    tagNm?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'tag_desc',
    })
    tagDesc?: string;

    @Column('boolean', {
        nullable: false,
        name: 'actv_ind',
    })
    actvInd?: boolean;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'ins_dttm',
    })
    insDttm?: Date;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'upd_dttm',
    })
    updDttm?: Date;

    @Column('int4', {
        nullable: false,
        default: 1,
        name: 'aud_ver',
    })
    audVer?: number;
}
