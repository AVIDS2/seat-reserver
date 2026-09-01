import { EntityRelationalHelper } from '../../utils/relational-entity-helper';
import { UserEntity } from '../../users/infrastructure/persistence/relational/entities/user.entity';
import { BookingTaskEntity } from './booking-task.entity';
import { SchoolAccountEntity } from './school-account.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';

@Entity({ name: 'platform_booking_run' })
export class BookingRunEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String, length: 20 })
  runType: 'prewarm' | 'booking';

  @Column({ type: String, length: 20, default: 'pending' })
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';

  @Column({ type: 'date' })
  targetDate: string;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: String, length: 120, nullable: true })
  receipt: string | null;

  @Column({ type: String, length: 255, nullable: true })
  location: string | null;

  @Column({ type: String, length: 30, nullable: true })
  reservedBegin: string | null;

  @Column({ type: String, length: 30, nullable: true })
  reservedEnd: string | null;

  @Column({ type: 'integer', nullable: true })
  httpStatus: number | null;

  @Column({ type: String, length: 30, nullable: true })
  responseCode: string | null;

  @Column({ default: 0 })
  attemptsUsed: number;

  @ManyToOne(() => BookingTaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: BookingTaskEntity;

  @RelationId((run: BookingRunEntity) => run.task)
  taskId: number;

  @ManyToOne(() => SchoolAccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schoolAccountId' })
  schoolAccount: SchoolAccountEntity;

  @RelationId((run: BookingRunEntity) => run.schoolAccount)
  schoolAccountId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((run: BookingRunEntity) => run.user)
  userId: number;

  @CreateDateColumn()
  createdAt: Date;
}
