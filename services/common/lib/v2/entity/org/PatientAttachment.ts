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

@Entity('patient_attachment', { schema: 'graphium' })
export class PatientAttachment {
    @PrimaryGeneratedColumn('increment', {
        name: 'patient_attachment_id',
    })
    patientAttachmentId?: number;

    @Column('int8', {
        nullable: false,
        name: 'patient_id',
    })
    patientId?: number;

    @Column('text', {
        nullable: false,
        name: 'patient_attachment_type',
    })
    patientAttachmentType?: string;

    @Column('text', {
        nullable: false,
        name: 'patient_attachment_filename',
    })
    patientAttachmentFilename?: string;

    @Column('text', {
        nullable: true,
        name: 'patient_attachment_description',
    })
    patientAttachmentDescription?: string;

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
}
