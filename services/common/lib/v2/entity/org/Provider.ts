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
import { Facility } from './Facility';

@Entity('prvr', { schema: 'graphium' })
export class Provider {
    @PrimaryGeneratedColumn('increment', {
        name: 'prvr_id',
    })
    prvrId: number;

    @Column('int4', {
        nullable: false,
        name: 'fac_id',
    })
    facId: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'prvr_typ',
    })
    prvrTyp?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'frst_nm',
    })
    frstNm?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'last_nm',
    })
    lastNm?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'natl_prvr_id',
    })
    natlPrvrId?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'local_prvr_id',
    })
    localPrvrId?: string;

    @Column('varchar', {
        nullable: false,
        length: 1000,
        name: 'spclty',
    })
    spclty?: string;

    @Column('varchar', {
        nullable: true,
        length: 1000,
        name: 'group_nm',
    })
    groupNm?: string;

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

    @Column('text', {
        nullable: true,
        name: 'prvr_details',
    })
    prvrDetails?: string;

    @ManyToOne(() => Facility, (facility) => facility.providers)
    @JoinColumn({ name: 'fac_id' })
    facility?: Facility;

    public toLegacyJson():any {
        return {
            providerId: this.prvrId,
            facilityId: this.facId,
            providerType: this.prvrTyp,
            firstName: this.frstNm,
            lastName: this.lastNm,
            nationalProviderId: this.natlPrvrId,
            localProviderId: this.localPrvrId,
            speciality: this.spclty,
            groupName: this.groupNm,
            activeIndicator: this.actvInd,
            createTime: this.insDttm,
            updateTime: this.updDttm,
            auditVersion: this.audVer
        };
    }
}
