import { EntityRelationalHelper } from '../../utils/relational-entity-helper';
import { UserEntity } from '../../users/infrastructure/persistence/relational/entities/user.entity';
import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { PlatformInvitationEntity } from './platform-invitation.entity';

@Entity({ name: 'platform_invitation_use' })
@Index(
  'UQ_platform_invitation_use_invitation_user',
  ['invitationId', 'userId'],
  {
    unique: true,
  },
)
export class PlatformInvitationUseEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PlatformInvitationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitationId' })
  invitation: PlatformInvitationEntity;

  @RelationId((use: PlatformInvitationUseEntity) => use.invitation)
  invitationId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((use: PlatformInvitationUseEntity) => use.user)
  userId: number;

  @CreateDateColumn()
  usedAt: Date;
}
