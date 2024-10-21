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
import { OrgUser } from './OrgUser';

@Entity('org', { schema: 'graphium' })
export class Org {
    @PrimaryGeneratedColumn('increment', {
        name: 'org_id',
    })
    orgId?: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'org_nm',
    })
    orgNm?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'org_nm_intrnl',
    })
    orgNmIntrnl?: string;

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

    @OneToMany(() => OrgUser, (org) => org.details)
    details?: OrgUser;
}
