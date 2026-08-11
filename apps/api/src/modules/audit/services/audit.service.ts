import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { AuditRecord } from '../entities/audit-record.entity';
import { AuditEventDto } from '../dto/audit-event.dto';
import { AuditQueryDto } from '../dto/audit-query.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditRecord)
    private auditRepository: Repository<AuditRecord>,
  ) {}

  async record(
    dto: AuditEventDto,
    transactionManager?: EntityManager,
  ): Promise<AuditRecord> {
    const record = new AuditRecord();
    record.actor_id = dto.actorId;
    record.actor_role = dto.actorRole;
    record.action = dto.action;
    record.resource_type = dto.resourceType;
    record.resource_id = dto.resourceId;
    record.change_detail = dto.changeDetail;
    record.approval_chain = dto.approvalChain ?? null;
    record.request_id = dto.requestId ?? null;

    const repo = transactionManager
      ? transactionManager.getRepository(AuditRecord)
      : this.auditRepository;

    const saved = await repo.save(record);
    this.logger.log(
      `Audit record created: ${saved.id} - ${dto.action} by ${dto.actorRole}`,
    );
    return saved;
  }

  async query(dto: AuditQueryDto): Promise<{ records: AuditRecord[]; total: number }> {
    const query = this.auditRepository.createQueryBuilder('audit');

    if (dto.clusterId) {
      query.andWhere(
        "audit.resource_type = 'cluster' AND audit.resource_id = :clusterId",
        { clusterId: dto.clusterId },
      );
    }

    if (dto.actorId) {
      query.andWhere('audit.actor_id = :actorId', { actorId: dto.actorId });
    }

    if (dto.action) {
      query.andWhere('audit.action = :action', { action: dto.action });
    }

    if (dto.resourceType) {
      query.andWhere('audit.resource_type = :resourceType', {
        resourceType: dto.resourceType,
      });
    }

    if (dto.startDate) {
      query.andWhere('audit.occurred_at >= :startDate', { startDate: dto.startDate });
    }

    if (dto.endDate) {
      query.andWhere('audit.occurred_at <= :endDate', { endDate: dto.endDate });
    }

    query.orderBy('audit.occurred_at', 'DESC');
    query.skip(dto.offset ?? 0);
    query.take(dto.limit ?? 100);

    const [records, total] = await query.getManyAndCount();
    return { records, total };
  }
}
