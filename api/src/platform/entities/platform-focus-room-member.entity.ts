import { EntityRelationalHelper } from '../../utils/relational-entity-helper';
import { UserEntity } from '../../users/infrastructure/persistence/relational/entities/user.entity';
import { PlatformFocusRoomEntity } from './platform-focus-room.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'platform_focus_room_member' })
@Index('UQ_platform_focus_room_member_room_user', ['room', 'user'], {
  unique: true,
})
export class PlatformFocusRoomMemberEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'boolean', default: false })
  isFocused: boolean;

  @Column({ type: 'integer', default: 0 })
  focusSeconds: number;

  @Column({ type: 'timestamp', nullable: true })
  focusStartedAt: Date | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  lastSeenAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt: Date | null;

  @ManyToOne(() => PlatformFocusRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: PlatformFocusRoomEntity;

  @RelationId((member: PlatformFocusRoomMemberEntity) => member.room)
  roomId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((member: PlatformFocusRoomMemberEntity) => member.user)
  userId: number;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
