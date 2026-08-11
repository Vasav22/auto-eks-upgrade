import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('permissions')
@Unique(['roleId', 'resourceType', 'action', 'environmentScope'])
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId!: string;

  @Column({ type: 'varchar', nullable: false, name: 'resource_type' })
  resourceType!: string;

  @Column({ type: 'varchar', nullable: false })
  action!: string;

  @Column({ type: 'varchar', nullable: false, name: 'environment_scope' })
  environmentScope!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Role, (role) => role.permissions)
  @JoinColumn({ name: 'role_id' })
  role!: Role;
}
