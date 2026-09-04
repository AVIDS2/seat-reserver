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

@Entity({ name: 'platform_pro_request' })
export class PlatformProRequestEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, default: 'pro' })
  plan: 'pro';

  @Column({ type: 'integer', default: 2000 })
  priceCents: number;

  @Column({ length: 20, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamp', nullable: true })
  handledAt: Date | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @RelationId((request: PlatformProRequestEntity) => request.user)
  userId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'handledByUserId' })
  handledByUser: UserEntity | null;

  @RelationId((request: PlatformProRequestEntity) => request.handledByUser)
  handledByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
