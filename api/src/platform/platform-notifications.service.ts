import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformNotificationEntity } from './entities/platform-notification.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

export type PlatformNotificationView = {
  id: string;
  kind: string;
  title: string;
  body: string;
  status: 'unread' | 'read';
  createdAt: string;
  actionUrl: string | null;
};

@Injectable()
export class PlatformNotificationsService {
  constructor(
    @InjectRepository(PlatformNotificationEntity)
    private readonly notifications: Repository<PlatformNotificationEntity>,
  ) {}

  async list(userId: number): Promise<PlatformNotificationView[]> {
    const notifications = await this.notifications.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return notifications.map((notification) => this.toView(notification));
  }

  async create(input: {
    userId: number;
    kind: string;
    title: string;
    body: string;
    actionUrl?: string | null;
  }): Promise<PlatformNotificationView> {
    const notification = this.notifications.create({
      kind: input.kind,
      title: input.title,
      body: input.body,
      status: 'unread',
      actionUrl: input.actionUrl ?? null,
      readAt: null,
      user: { id: input.userId } as UserEntity,
    });
    return this.toView(await this.notifications.save(notification));
  }

  async markRead(
    userId: number,
    id: number,
  ): Promise<PlatformNotificationView> {
    const notification = await this.notifications.findOne({
      where: { id, user: { id: userId } },
    });
    if (!notification) throw new NotFoundException('通知不存在');
    notification.status = 'read';
    notification.readAt = new Date();
    return this.toView(await this.notifications.save(notification));
  }

  async markAllRead(userId: number): Promise<void> {
    await this.notifications
      .createQueryBuilder()
      .update(PlatformNotificationEntity)
      .set({ status: 'read', readAt: new Date() })
      .where('"userId" = :userId AND "status" = :status', {
        userId,
        status: 'unread',
      })
      .execute();
  }

  private toView(
    notification: PlatformNotificationEntity,
  ): PlatformNotificationView {
    return {
      id: String(notification.id),
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      status: notification.status,
      createdAt: notification.createdAt.toISOString(),
      actionUrl: notification.actionUrl,
    };
  }
}
