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
import { Team } from './Team';
import { Event } from './Event';
import { Patient } from './Patient';
import { Provider } from './Provider';

@Entity('fac', { schema: 'graphium' })
export class Facility {
    @PrimaryGeneratedColumn('increment', {
        name: 'fac_id',
    })
    facId: number;

    @Column('int8', {
        nullable: false,
        name: 'org_id',
    })
    orgId: number;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'fac_nm',
    })
    facNm?: string;

    @Column('text', {
        nullable: true,
        name: 'fac_desc',
    })
    facDesc?: string;

    @Column('varchar', {
        nullable: true,
        length: 1000,
        name: 'addr_ln_1',
    })
    addrLn1?: string;

    @Column('varchar', {
        nullable: true,
        length: 1000,
        name: 'addr_ln_2',
    })
    addrLn2?: string;

    @Column('varchar', {
        nullable: true,
        length: 1000,
        name: 'addr_city_nm',
    })
    addrCityNm?: string;

    @Column('varchar', {
        nullable: true,
        length: 100,
        name: 'addr_st_cd',
    })
    addrStCd?: string;

    @Column('varchar', {
        nullable: true,
        length: 100,
        name: 'addr_zip_cd',
    })
    addrZipCd?: string;

    @Column('varchar', {
        nullable: true,
        length: 100,
        name: 'ph_no_main',
    })
    phNoMain?: string;

    @Column('boolean', {
        nullable: false,
        default: true,
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

    @Column('text', {
        nullable: true,
        name: 'fac_nm_intrnl',
    })
    facNmIntrnl?: number;

    @Column('boolean', {
        nullable: true,
        default: false,
        name: 'test_fac_ind',
    })
    testFacInd?: boolean;

    @OneToOne(() => Team, (team) => team.facility)
    team?: Team;

    @OneToMany(() => Event, (event) => event.facility)
    events?: Event[];

    @OneToMany(() => Patient, (patient) => patient.facility)
    patients?: Patient[];

    @OneToMany(() => Provider, (provider) => provider.facility)
    providers?: Provider[];
}
