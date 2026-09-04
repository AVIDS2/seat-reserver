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
import { PlatformInvitationEntity } from './platform-invitation.entity';

@Entity({ name: 'platform_referral' })
export class PlatformReferralEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, default: 'pending' })
  status: 'pending' | 'qualified' | 'rejected';

  @Column({ type: 'timestamp', nullable: true })
  qualifiedAt: Date | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrerUserId' })
  referrerUser: UserEntity;

  @RelationId((referral: PlatformReferralEntity) => referral.referrerUser)
  referrerUserId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referredUserId' })
  referredUser: UserEntity;

  @RelationId((referral: PlatformReferralEntity) => referral.referredUser)
  referredUserId: number;

  @ManyToOne(() => PlatformInvitationEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'invitationId' })
  invitation: PlatformInvitationEntity | null;

  @RelationId((referral: PlatformReferralEntity) => referral.invitation)
  invitationId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
