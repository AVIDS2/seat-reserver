import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import type { RunStatus, TaskStatus } from '../types';

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = {
    enabled: {
      label: '已启用',
      icon: Icons.circleCheck,
      className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    },
    paused: {
      label: '已暂停',
      icon: Icons.pause,
      className: 'border-border bg-muted text-muted-foreground'
    },
    attention: {
      label: '需要关注',
      icon: Icons.warning,
      className: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400'
    }
  }[status];
  const Icon = config.icon;

  return (
    <Badge variant='outline' className={config.className}>
      <Icon />
      {config.label}
    </Badge>
  );
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const config = {
    success: {
      label: '预约成功',
      icon: Icons.circleCheck,
      className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    },
    failed: {
      label: '未抢到',
      icon: Icons.circleX,
      className: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400'
    },
    prewarming: {
      label: '预热中',
      icon: Icons.refresh,
      className: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400'
    },
    running: {
      label: '执行中',
      icon: Icons.play,
      className: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400'
    },
    pending: {
      label: '排队中',
      icon: Icons.clock,
      className: 'border-border bg-muted text-muted-foreground'
    },
    skipped: {
      label: '已跳过',
      icon: Icons.minus,
      className: 'border-border bg-muted text-muted-foreground'
    }
  }[status];
  const Icon = config.icon;

  return (
    <Badge variant='outline' className={config.className}>
      <Icon className={status === 'running' || status === 'prewarming' ? 'animate-spin' : ''} />
      {config.label}
    </Badge>
  );
}
