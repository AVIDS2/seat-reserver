export type TaskStatus = 'enabled' | 'paused' | 'attention';
export type RunStatus = 'success' | 'failed' | 'prewarming' | 'running' | 'pending' | 'skipped';
export type AccountStatus = 'connected' | 'attention';
export type VenueType = 'library' | 'study_room' | 'other';

export type TimeCandidate = { start: number; end: number };

export type BookingTask = {
  id: string;
  name: string;
  venueType: VenueType;
  building: string;
  roomName: string;
  seatLabel: string | null;
  account: string;
  accountId: string;
  seat: string;
  seatId: string;
  time: string;
  nextRun: string;
  status: TaskStatus;
  enabled: boolean;
  backupSeatIds: string[];
  timeCandidates: TimeCandidate[];
  maxAttempts: number;
  attemptDelaySeconds: number;
  bookingWindowSeconds: number;
  prewarmOffsetSeconds: number;
  runOffsetSeconds: number;
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
  summary: BookingSummary;
};

export type BookingSummary = {
  enabledTasks: number;
  totalTasks: number;
  totalAccounts: number;
  connectedAccounts: number;
  successRate: number | null;
  candidateGroups: number;
  prewarmTime: string;
  executionTime: string;
  bookingWindowSeconds: number;
  executionDate: string;
  lastCheckedAt: string;
};

export type PlatformNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  status: 'unread' | 'read';
  createdAt: string;
  actionUrl: string | null;
};
