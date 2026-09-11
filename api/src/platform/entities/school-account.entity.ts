import { EntityRelationalHelper } from '../../utils/relational-entity-helper';
import { UserEntity } from '../../users/infrastructure/persistence/relational/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import type { SchoolCode } from '../school-catalog';

@Entity({ name: 'platform_school_account' })
export class SchoolAccountEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  label: string;

  @Column({ length: 40, default: 'cczu' })
  schoolCode: SchoolCode;

  @Column({ length: 100 })
  schoolUsername: string;

  @Column({ type: 'text' })
  encryptedSchoolPassword: string;

  @Column({ type: 'text', nullable: true })
  encryptedToken: string | null;

  @Column({ length: 20, default: 'direct' })
  authMode: 'direct' | 'webvpn';

  @Column({ length: 30, default: 'active' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  tokenRefreshedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastVerifiedAt: Date | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((account: SchoolAccountEntity) => account.user)
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
