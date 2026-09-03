import { EntityRelationalHelper } from '../../utils/relational-entity-helper';
import { UserEntity } from '../../users/infrastructure/persistence/relational/entities/user.entity';
import { SchoolAccountEntity } from './school-account.entity';
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

export type TimeCandidate = { start: number; end: number };

@Entity({ name: 'platform_booking_task' })
export class BookingTaskEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20, default: 'study_room' })
  venueType: 'library' | 'study_room' | 'other';

  @Column({ length: 50, default: '未指定' })
  building: string;

  @Column({ length: 120, default: '未指定' })
  roomName: string;

  @Column({ type: String, length: 30, nullable: true })
  buildingId: string | null;

  @Column({ type: String, length: 30, nullable: true })
  roomId: string | null;

  @Column({ length: 20, default: 'daily' })
  scheduleMode: 'daily' | 'once';

  @Column({ type: 'date', nullable: true })
  targetDate: string | null;

  @Column({ length: 30 })
  primarySeatId: string;

  @Column({ type: String, length: 30, nullable: true })
  primarySeatLabel: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  backupSeatIds: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  backupSeatLabels: string[];

  @Column({ type: 'jsonb' })
  timeCandidates: TimeCandidate[];

  @Column({ default: 12 })
  maxAttempts: number;

  @Column({ type: 'double precision', default: 1.2 })
  attemptDelaySeconds: number;

  @Column({ type: 'double precision', default: 20 })
  bookingWindowSeconds: number;

  @Column({ default: 0 })
  prewarmOffsetSeconds: number;

  @Column({ default: 1 })
  runOffsetSeconds: number;

  @Column({ default: true })
  enabled: boolean;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((task: BookingTaskEntity) => task.user)
  userId: number;

  @ManyToOne(() => SchoolAccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schoolAccountId' })
  schoolAccount: SchoolAccountEntity;

  @RelationId((task: BookingTaskEntity) => task.schoolAccount)
  schoolAccountId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
