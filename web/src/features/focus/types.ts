export type FocusRoomTimerStatus = 'idle' | 'running' | 'paused';
export type FocusRoomPhase = 'focus' | 'short_break' | 'long_break';

export type FocusRoomMember = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  titleLabel: string;
  badgeLabel: string;
  isHost: boolean;
  isFocused: boolean | null;
  focusSeconds: number | null;
  focusMinutesLabel: string | null;
  lastSeenAt: string;
};

export type FocusRoomSummary = {
  id: string;
  joinCode: string;
  name: string;
  isPublic: boolean;
  shareFocusData: boolean;
  hostName: string;
  memberCount: number;
  maxMembers: number;
  isMember: boolean;
  isHost: boolean;
  timerStatus: FocusRoomTimerStatus;
  phase: FocusRoomPhase;
  remainingSeconds: number;
  completedRounds: number;
  updatedAt: string;
};

export type FocusRoom = FocusRoomSummary & {
  serverTime: string;
  settings: {
    workMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    roundsBeforeLongBreak: number;
  };
  timer: {
    status: FocusRoomTimerStatus;
    phase: FocusRoomPhase;
    phaseStartedAt: string | null;
    phaseEndsAt: string | null;
    remainingSeconds: number;
    completedRounds: number;
  };
  members: FocusRoomMember[];
  currentUser: FocusRoomMember | null;
};

export type FocusRoomsSnapshot = {
  rooms: FocusRoomSummary[];
  joinedRoomIds: string[];
  serverTime: string;
};

export type CreateFocusRoomInput = {
  name: string;
  isPublic: boolean;
  shareFocusData: boolean;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLongBreak: number;
};
