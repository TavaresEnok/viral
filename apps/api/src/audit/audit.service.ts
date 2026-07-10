import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@viralforge/database';
import { PrismaService } from '../prisma.service.js';

export interface AuditEvent {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: event.userId ?? null,
          action: event.action,
          entityType: event.entityType ?? null,
          entityId: event.entityId ?? null,
          ip: event.ip ?? null,
          metadata: event.metadata ?? undefined,
        },
      });
    } catch (error) {
      this.logger.warn({ msg: 'Audit log write failed', action: event.action, error: error instanceof Error ? error.message : error });
    }
  }
}
