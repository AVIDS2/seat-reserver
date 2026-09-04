import { EntityRelationalHelper } from '../../utils/relational-entity-helper';
import { UserEntity } from '../../users/infrastructure/persistence/relational/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SchoolAccountEntity } from './school-account.entity';

export type SeatServiceType = 'study_room' | 'library';

@Entity({ name: 'platform_school_service_connection' })
@Unique('UQ_platform_service_connection_account_service', [
  'schoolAccount',
  'serviceType',
])
export class SchoolServiceConnectionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  serviceType: SeatServiceType;

  @Column({ length: 40 })
  identifier: string;

  @Column({ type: 'text', nullable: true })
  encryptedToken: string | null;

  @Column({ type: 'text', nullable: true })
  encryptedWebVpnSession: string | null;

  @Column({ length: 20, default: 'webvpn' })
  authMode: 'direct' | 'webvpn';

  @Column({ length: 30, default: 'active' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  tokenRefreshedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastVerifiedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  webVpnSessionUpdatedAt: Date | null;

  @ManyToOne(() => SchoolAccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schoolAccountId' })
  schoolAccount: SchoolAccountEntity;

  @RelationId(
    (connection: SchoolServiceConnectionEntity) => connection.schoolAccount,
  )
  schoolAccountId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((connection: SchoolServiceConnectionEntity) => connection.user)
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
