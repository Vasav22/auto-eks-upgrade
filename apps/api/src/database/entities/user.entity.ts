import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Session } from './session.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: false, name: 'oidc_subject' })
  oidcSubject!: string;

  @Column({ type: 'varchar', nullable: false })
  email!: string;

  @Column({ type: 'varchar', nullable: false, name: 'display_name' })
  displayName!: string;

  @Column({ type: 'varchar', nullable: false })
  role!: string;

  @Column({ type: 'varchar', nullable: false, default: 'active' })
  status!: string;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Session, (session) => session.user)
  sessions!: Session[];
}
