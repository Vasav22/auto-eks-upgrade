import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', nullable: false, name: 'refresh_token_hash' })
  refreshTokenHash!: string;

  @Column({ type: 'inet', nullable: true, name: 'ip_address' })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent!: string | null;

  @Column({ type: 'timestamp', nullable: false, name: 'idle_timeout_at' })
  idleTimeoutAt!: Date;

  @Column({ type: 'timestamp', nullable: false, name: 'absolute_timeout_at' })
  absoluteTimeoutAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'revoked_at' })
  revokedAt!: Date | null;

  @ManyToOne(() => User, (user) => user.sessions)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
