import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingRunEntity } from './entities/booking-run.entity';

export type BookingRunView = {
  id: string;
  account: string;
  task: string;
  targetDate: string;
  startedAt: string;
  status: 'success' | 'failed' | 'prewarming' | 'running';
  statusLabel: string;
  attempts: number;
  result: string;
  detail: string;
};

@Injectable()
export class PlatformRunsService {
  constructor(
    @InjectRepository(BookingRunEntity)
    private readonly runs: Repository<BookingRunEntity>,
  ) {}

  async list(userId: number): Promise<BookingRunView[]> {
    const runs = await this.runs.find({
      where: { user: { id: userId } },
      relations: ['task', 'schoolAccount'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return runs.map((run) => this.toView(run));
  }

  async findOwned(userId: number, id: number): Promise<BookingRunView> {
    const run = await this.runs.findOne({
      where: { id, user: { id: userId } },
      relations: ['task', 'schoolAccount'],
    });
    if (!run) throw new NotFoundException('运行记录不存在');
    return this.toView(run);
  }

  private toView(run: BookingRunEntity): BookingRunView {
    const status =
      run.status === 'success'
        ? 'success'
        : run.status === 'failed'
          ? 'failed'
          : run.status === 'running'
            ? 'running'
            : 'prewarming';
    const statusLabel =
      status === 'success'
        ? '预约成功'
        : status === 'failed'
          ? '未抢到'
          : status === 'running'
            ? '执行中'
            : '预热中';
    return {
      id: String(run.id),
      account: run.schoolAccount?.label ?? '未知账号',
      task:
        run.task?.name ??
        (run.runType === 'prewarm' ? 'Token 预热' : '预约任务'),
      targetDate: run.targetDate,
      startedAt: formatDate(run.startedAt ?? run.createdAt),
      status,
      statusLabel,
      attempts: run.attemptsUsed,
      result: run.receipt
        ? `${run.reservedBegin ?? ''} - ${run.reservedEnd ?? ''}`.trim()
        : run.status === 'failed'
          ? '窗口结束'
          : '处理中',
      detail: run.message ?? '任务已进入队列，等待执行。',
    };
  }
}

function formatDate(value: Date): string {
  return value.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
