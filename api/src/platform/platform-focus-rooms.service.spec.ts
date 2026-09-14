import { describe, expect, it, jest } from '@jest/globals';
import { PlatformFocusRoomsService } from './platform-focus-rooms.service';
import type { PlatformFocusRoomMemberEntity } from './entities/platform-focus-room-member.entity';
import type { PlatformFocusRoomEntity } from './entities/platform-focus-room.entity';

function makeHarness() {
  const room = {
    id: 1,
    joinCode: 'A7K2P9',
    name: '晚自习',
    isPublic: true,
    shareFocusData: true,
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    roundsBeforeLongBreak: 4,
    status: 'open',
    timerStatus: 'idle',
    phase: 'focus',
    phaseStartedAt: null,
    phaseEndsAt: null,
    pausedRemainingSeconds: null,
    completedRounds: 0,
    lastActiveAt: new Date('2026-09-14T10:00:00.000Z'),
    closedAt: null,
    hostUserId: 7,
    hostUser: { id: 7, firstName: '房主', lastName: '同学' },
  } as unknown as PlatformFocusRoomEntity;
  const member = {
    id: 10,
    roomId: 1,
    userId: 7,
    isFocused: false,
    focusSeconds: 0,
    focusStartedAt: null,
    lastSeenAt: new Date(),
    leftAt: null,
    user: { id: 7, firstName: '房主', lastName: '同学' },
  } as unknown as PlatformFocusRoomMemberEntity;
  const rooms = {
    findOne: jest.fn(() => Promise.resolve(room)),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const members = {
    findOne: jest.fn(() => Promise.resolve(member)),
    find: jest.fn(() => Promise.resolve([member])),
    count: jest.fn(() => Promise.resolve(1)),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const showcase = {
    getPublicDecorations: jest.fn(() => Promise.resolve(new Map())),
  };
  return {
    room,
    member,
    rooms,
    members,
    service: new PlatformFocusRoomsService(
      rooms as never,
      members as never,
      showcase as never,
    ),
  };
}

describe('PlatformFocusRoomsService', () => {
  it('should start a server-timed focus phase only for the room host', async () => {
    const { room, service } = makeHarness();

    const result = await service.timerAction(7, 1, 'start');

    expect(room.timerStatus).toBe('running');
    expect(room.phaseStartedAt).toBeInstanceOf(Date);
    expect(room.phaseEndsAt).toBeInstanceOf(Date);
    expect(result.timer.status).toBe('running');
    expect(result.timer.remainingSeconds).toBeGreaterThan(0);
  });

  it('should reject a non-member from a private room', async () => {
    const { room, members, service } = makeHarness();
    room.isPublic = false;
    members.findOne.mockResolvedValue(null as never);

    await expect(service.get(9, 1)).rejects.toThrow('仅限受邀成员');
  });

  it('should keep private focus data visible to the member who owns it', async () => {
    const { room, member, service } = makeHarness();
    room.shareFocusData = false;
    member.isFocused = true;
    member.focusStartedAt = new Date(Date.now() - 60_000);
    member.lastSeenAt = new Date();

    const result = await service.get(7, 1);

    expect(result.currentUser?.isFocused).toBe(true);
    expect(result.currentUser?.focusSeconds).not.toBeNull();
  });
});
