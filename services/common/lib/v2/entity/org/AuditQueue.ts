import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('audit_queue', { schema: 'graphium' })
export class AuditQueue {
    @PrimaryColumn('int8', {
        name: 'audit_queue_id',
    })
    auditQueueId?: number;

    @Column('jsonb', {
        nullable: false,
        name: 'audit_object',
    })
    auditObject?: any;

    @Column('timestamp with time zone', {
        nullable: false,
        name: 'ins_dttm',
    })
    insDttm?: Date;
}
