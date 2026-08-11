import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Session } from '../entities/session.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(Session)
    private repository: Repository<Session>,
  ) {}

  async findActiveByTokenFamily(tokenFamily: string): Promise<Session[]> {
    return this.repository.find({
      where: {
        token_family: tokenFamily,
        is_revoked: false,
      },
      order: { created_at: 'DESC' },
    });
  }

  async invalidateTokenFamily(tokenFamily: string): Promise<void> {
    await this.repository.update(
      { token_family: tokenFamily },
      { is_revoked: true },
    );
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    await this.repository.update({ user_id: userId }, { is_revoked: true });
  }

  async findExpiredSessions(): Promise<Session[]> {
    return this.repository.find({
      where: {
        expires_at: LessThan(new Date()),
      },
    });
  }

  async purgeOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.repository.delete({
      created_at: LessThan(cutoffDate),
    });

    return result.affected ?? 0;
  }

  async save(session: Session): Promise<Session> {
    return this.repository.save(session);
  }

  async findOne(id: string): Promise<Session | null> {
    return this.repository.findOne({ where: { id } });
  }
}
