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
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'platform_membership' })
export class PlatformMembershipEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, default: 'free' })
  plan: 'free' | 'pro';

  @Column({ type: 'timestamp', nullable: true })
  proActivatedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  proExpiresAt: Date | null;

  @Column({ length: 30, default: 'manual' })
  source: 'manual' | 'admin' | 'payment';

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((membership: PlatformMembershipEntity) => membership.user)
  userId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'grantedByUserId' })
  grantedByUser: UserEntity | null;

  @RelationId(
    (membership: PlatformMembershipEntity) => membership.grantedByUser,
  )
  grantedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
