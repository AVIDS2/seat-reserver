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
} from 'typeorm';

@Entity({ name: 'platform_points_ledger' })
export class PlatformPointsLedgerEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'integer' })
  balanceAfter: number;

  @Column({ length: 40 })
  eventType: string;

  @Column({ length: 160, unique: true })
  eventKey: string;

  @Column({ length: 200 })
  description: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((entry: PlatformPointsLedgerEntity) => entry.user)
  userId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: UserEntity | null;

  @RelationId((entry: PlatformPointsLedgerEntity) => entry.createdByUser)
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
