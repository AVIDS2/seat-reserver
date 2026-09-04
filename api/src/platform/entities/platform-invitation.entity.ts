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

@Entity({ name: 'platform_invitation' })
export class PlatformInvitationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, unique: true })
  codeHash: string;

  @Column({ default: 1 })
  maxUses: number;

  @Column({ default: 0 })
  usedCount: number;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: String, length: 20, default: 'active' })
  status: 'active' | 'disabled' | 'exhausted';

  @Column({ type: String, length: 20, default: 'admin' })
  source: 'admin' | 'community';

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: UserEntity | null;

  @RelationId(
    (invitation: PlatformInvitationEntity) => invitation.createdByUser,
  )
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
