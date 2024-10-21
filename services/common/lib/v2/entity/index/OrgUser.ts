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
import { User } from './User';
import { Org } from './Org';

@Entity('org_usr', { schema: 'graphium' })
export class OrgUser {
    @PrimaryColumn('int8', {
        nullable: false,
        name: 'org_id',
    })
    orgId: number;

    @PrimaryColumn('int8', {
        nullable: false,
        name: 'usr_id',
    })
    usrId: number;

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

    @Column('int4', {
        nullable: false,
        default: 1,
        name: 'aud_ver',
    })
    audVer: number;

    @ManyToOne(() => User, (user) => user.orgs)
    @JoinColumn({ name: 'usr_id' })
    user?: User[];

    @ManyToOne(() => Org, (org) => org.details)
    @JoinColumn({ name: 'org_id' })
    details?: Org;
}
