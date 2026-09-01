export type TaskStatus = 'enabled' | 'paused' | 'attention';
export type RunStatus = 'success' | 'failed' | 'prewarming' | 'running';
export type AccountStatus = 'connected' | 'attention';

export type BookingTask = {
  id: string;
  name: string;
  account: string;
  accountId: string;
  seat: string;
  seatId: string;
  time: string;
  nextRun: string;
  status: TaskStatus;
  enabled: boolean;
  lastRun: string;
  lastMessage: string;
};

export type BookingAccount = {
  id: string;
  label: string;
  username: string;
  status: AccountStatus;
  statusLabel: string;
  tokenLabel: string;
  refreshedAt: string;
  lastVerifiedAt: string;
  tasks: number;
};

export type BookingRun = {
  id: string;
  account: string;
  task: string;
  targetDate: string;
  startedAt: string;
  status: RunStatus;
  statusLabel: string;
  attempts: number;
  result: string;
  detail: string;
};

export type BookingSnapshot = {
  tasks: BookingTask[];
  accounts: BookingAccount[];
  runs: BookingRun[];
};
