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

@Entity('aud_typ', { schema: 'graphium' })
export class AudType {
    @Column('integer', {
        nullable: false,
        primary: true,
        name: 'aud_typ_id',
    })
    audTypId: number;

    @Column('text', {
        nullable: false,
        name: 'aud_typ_cd',
    })
    audTypCd: string;

    @Column('text', {
        nullable: false,
        name: 'aud_typ_desc',
    })
    audTypDesc: string;

    @Column('text', {
        nullable: true,
        name: 'aud_expsn',
    })
    audExpsn: string;

    @Column('boolean', {
        nullable: false,
        name: 'actv_ind',
    })
    actvInd: boolean;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'ins_dttm',
    })
    insDttm: Date;

    @Column('timestamp with time zone', {
        nullable: false,
        default: 'now()',
        name: 'upd_dttm',
    })
    updDttm: Date;

    @Column('integer', {
        nullable: false,
        default: 1,
        name: 'aud_ver',
    })
    audVer: number;
}
