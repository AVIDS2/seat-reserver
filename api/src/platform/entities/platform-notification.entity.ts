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

@Entity({ name: 'platform_notification' })
export class PlatformNotificationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String, length: 30 })
  kind: string;

  @Column({ type: String, length: 160 })
  title: string;

  @Column({ type: String, length: 500 })
  body: string;

  @Column({ type: String, length: 20, default: 'unread' })
  status: 'unread' | 'read';

  @Column({ type: String, length: 120, nullable: true })
  actionUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((notification: PlatformNotificationEntity) => notification.user)
  userId: number;

  @CreateDateColumn()
  createdAt: Date;
}
