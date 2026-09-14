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

export type FocusRoomStatus = 'open' | 'closed';
export type FocusRoomTimerStatus = 'idle' | 'running' | 'paused';
export type FocusRoomPhase = 'focus' | 'short_break' | 'long_break';

@Entity({ name: 'platform_focus_room' })
export class PlatformFocusRoomEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String, length: 8, unique: true })
  joinCode: string;

  @Column({ type: String, length: 80 })
  name: string;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ type: 'boolean', default: true })
  shareFocusData: boolean;

  @Column({ type: 'integer', default: 25 })
  workMinutes: number;

  @Column({ type: 'integer', default: 5 })
  shortBreakMinutes: number;

  @Column({ type: 'integer', default: 15 })
  longBreakMinutes: number;

  @Column({ type: 'integer', default: 4 })
  roundsBeforeLongBreak: number;

  @Column({ type: String, length: 20, default: 'open' })
  status: FocusRoomStatus;

  @Column({ type: String, length: 20, default: 'idle' })
  timerStatus: FocusRoomTimerStatus;

  @Column({ type: String, length: 20, default: 'focus' })
  phase: FocusRoomPhase;

  @Column({ type: 'timestamp', nullable: true })
  phaseStartedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  phaseEndsAt: Date | null;

  @Column({ type: 'integer', nullable: true })
  pausedRemainingSeconds: number | null;

  @Column({ type: 'integer', default: 0 })
  completedRounds: number;

  @Column({ type: 'timestamp', default: () => 'now()' })
  lastActiveAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostUserId' })
  hostUser: UserEntity;

  @RelationId((room: PlatformFocusRoomEntity) => room.hostUser)
  hostUserId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
