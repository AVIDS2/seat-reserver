import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { CreateFocusRoomDto } from './dto/platform-focus-room.dto';
import { PlatformFocusRoomMemberEntity } from './entities/platform-focus-room-member.entity';
import {
  FocusRoomPhase,
  FocusRoomTimerStatus,
  PlatformFocusRoomEntity,
} from './entities/platform-focus-room.entity';
import {
  PlatformProfileShowcaseService,
  type PublicProfileDecoration,
} from './platform-profile-showcase.service';

const MAX_MEMBERS = 20;
const ROOM_CODE_LENGTH = 6;
const PUBLIC_ROOM_WINDOW_MS = 24 * 60 * 60 * 1000;
const PRESENCE_TIMEOUT_MS = 60 * 1000;
const FOCUS_GRACE_MS = 45 * 1000;

export type FocusRoomMemberView = {
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

export type FocusRoomView = FocusRoomSummary & {
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
  members: FocusRoomMemberView[];
  currentUser: FocusRoomMemberView | null;
};

export type FocusRoomsSnapshot = {
  rooms: FocusRoomSummary[];
  joinedRoomIds: string[];
  serverTime: string;
};

@Injectable()
export class PlatformFocusRoomsService {
  constructor(
    @InjectRepository(PlatformFocusRoomEntity)
    private readonly rooms: Repository<PlatformFocusRoomEntity>,
    @InjectRepository(PlatformFocusRoomMemberEntity)
    private readonly members: Repository<PlatformFocusRoomMemberEntity>,
    private readonly showcase: PlatformProfileShowcaseService,
  ) {}

  async list(userId: number): Promise<FocusRoomsSnapshot> {
    const now = new Date();
    const publicSince = new Date(now.getTime() - PUBLIC_ROOM_WINDOW_MS);
    const [publicRooms, joinedMembers] = await Promise.all([
      this.rooms.find({
        where: {
          status: 'open',
          isPublic: true,
          lastActiveAt: MoreThan(publicSince),
        },
        relations: ['hostUser'],
        order: { lastActiveAt: 'DESC' },
        take: 30,
      }),
      this.members.find({
        where: { user: { id: userId }, leftAt: IsNull() },
        relations: ['room', 'room.hostUser'],
        order: { updatedAt: 'DESC' },
        take: 20,
      }),
    ]);
    const uniqueRooms = new Map<number, PlatformFocusRoomEntity>();
    for (const room of publicRooms) uniqueRooms.set(room.id, room);
    for (const member of joinedMembers) {
      if (member.room.status === 'open')
        uniqueRooms.set(member.room.id, member.room);
    }

    const rooms = await Promise.all(
      Array.from(uniqueRooms.values()).map((room) =>
        this.toSummary(room, userId, now),
      ),
    );
    rooms.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return {
      rooms,
      joinedRoomIds: joinedMembers.map((member) => String(member.roomId)),
      serverTime: now.toISOString(),
    };
  }

  async create(
    userId: number,
    dto: CreateFocusRoomDto,
  ): Promise<FocusRoomView> {
    const room = await this.rooms.manager.transaction(async (manager) => {
      const roomRepository = manager.getRepository(PlatformFocusRoomEntity);
      const memberRepository = manager.getRepository(
        PlatformFocusRoomMemberEntity,
      );
      const saved = await roomRepository.save(
        roomRepository.create({
          joinCode: await this.createJoinCode(roomRepository),
          name: dto.name.trim(),
          isPublic: dto.isPublic ?? true,
          shareFocusData: dto.shareFocusData ?? true,
          workMinutes: dto.workMinutes ?? 25,
          shortBreakMinutes: dto.shortBreakMinutes ?? 5,
          longBreakMinutes: dto.longBreakMinutes ?? 15,
          roundsBeforeLongBreak: dto.roundsBeforeLongBreak ?? 4,
          status: 'open',
          timerStatus: 'idle',
          phase: 'focus',
          phaseStartedAt: null,
          phaseEndsAt: null,
          pausedRemainingSeconds: null,
          completedRounds: 0,
          lastActiveAt: new Date(),
          closedAt: null,
          hostUser: { id: userId } as UserEntity,
        }),
      );
      await memberRepository.save(
        memberRepository.create({
          room: { id: saved.id } as PlatformFocusRoomEntity,
          user: { id: userId } as UserEntity,
          isFocused: false,
          focusSeconds: 0,
          focusStartedAt: null,
          lastSeenAt: new Date(),
          leftAt: null,
        }),
      );
      return saved;
    });
    return this.get(userId, room.id);
  }

  async join(userId: number, code: string): Promise<FocusRoomView> {
    const normalizedCode = code.trim().toUpperCase();
    const room = await this.rooms.findOne({
      where: { joinCode: normalizedCode, status: 'open' },
      relations: ['hostUser'],
    });
    if (!room) throw new NotFoundException('房间不存在或已经结束');

    const existing = await this.members.findOne({
      where: { room: { id: room.id }, user: { id: userId } },
    });
    if (existing?.leftAt === null) {
      existing.lastSeenAt = new Date();
      await this.members.save(existing);
      return this.get(userId, room.id);
    }

    const memberCount = await this.members.count({
      where: { room: { id: room.id }, leftAt: IsNull() },
    });
    if (memberCount >= MAX_MEMBERS)
      throw new UnprocessableEntityException('房间已满，换一个房间试试');

    const member =
      existing ??
      this.members.create({
        room: { id: room.id } as PlatformFocusRoomEntity,
        user: { id: userId } as UserEntity,
        isFocused: false,
        focusSeconds: 0,
        focusStartedAt: null,
        lastSeenAt: new Date(),
        leftAt: null,
      });
    member.isFocused = false;
    member.focusStartedAt = null;
    member.lastSeenAt = new Date();
    member.leftAt = null;
    await this.members.save(member);
    room.lastActiveAt = new Date();
    await this.rooms.save(room);
    return this.get(userId, room.id);
  }

  async get(userId: number, roomId: number): Promise<FocusRoomView> {
    const room = await this.findRoom(roomId);
    const membership = await this.findMembership(roomId, userId);
    if (!membership && !room.isPublic)
      throw new ForbiddenException('这个房间仅限受邀成员加入');
    const now = new Date();
    await this.syncTimer(room, now);
    const activeMembers = await this.getActiveMembers(room.id);
    return this.toRoomView(room, userId, membership, activeMembers, now);
  }

  async heartbeat(userId: number, roomId: number): Promise<FocusRoomView> {
    const room = await this.findRoom(roomId);
    const membership = await this.requireMembership(room, userId);
    const now = new Date();
    this.settleMember(membership, now);
    membership.lastSeenAt = now;
    await this.members.save(membership);
    room.lastActiveAt = now;
    await this.rooms.save(room);
    return this.get(userId, roomId);
  }

  async setFocus(
    userId: number,
    roomId: number,
    focused: boolean,
  ): Promise<FocusRoomView> {
    const room = await this.findRoom(roomId);
    const membership = await this.requireMembership(room, userId);
    const now = new Date();
    this.settleMember(membership, now);
    membership.isFocused = focused;
    membership.focusStartedAt = focused ? now : null;
    membership.lastSeenAt = now;
    await this.members.save(membership);
    room.lastActiveAt = now;
    await this.rooms.save(room);
    return this.get(userId, roomId);
  }

  async timerAction(
    userId: number,
    roomId: number,
    action: 'start' | 'pause' | 'reset',
  ): Promise<FocusRoomView> {
    const room = await this.findRoom(roomId);
    await this.requireHost(room, userId);
    const now = new Date();
    await this.syncTimer(room, now);

    if (action === 'start') {
      const remaining =
        room.timerStatus === 'paused' && room.pausedRemainingSeconds
          ? room.pausedRemainingSeconds
          : this.phaseDurationSeconds(room);
      room.timerStatus = 'running';
      room.phaseStartedAt = now;
      room.phaseEndsAt = new Date(now.getTime() + remaining * 1000);
      room.pausedRemainingSeconds = null;
    } else if (action === 'pause') {
      if (room.timerStatus === 'running' && room.phaseEndsAt) {
        room.pausedRemainingSeconds = Math.max(
          1,
          Math.ceil((room.phaseEndsAt.getTime() - now.getTime()) / 1000),
        );
        room.timerStatus = 'paused';
        room.phaseStartedAt = null;
        room.phaseEndsAt = null;
      }
    } else {
      room.timerStatus = 'idle';
      room.phase = 'focus';
      room.phaseStartedAt = null;
      room.phaseEndsAt = null;
      room.pausedRemainingSeconds = null;
      room.completedRounds = 0;
    }

    room.lastActiveAt = now;
    await this.rooms.save(room);
    return this.get(userId, roomId);
  }

  async leave(userId: number, roomId: number): Promise<void> {
    const room = await this.findRoom(roomId);
    if (room.hostUserId === userId)
      throw new UnprocessableEntityException('房主请使用“结束房间”');
    const membership = await this.requireMembership(room, userId);
    const now = new Date();
    this.settleMember(membership, now);
    membership.isFocused = false;
    membership.focusStartedAt = null;
    membership.lastSeenAt = now;
    membership.leftAt = now;
    await this.members.save(membership);
  }

  async close(userId: number, roomId: number): Promise<void> {
    const room = await this.findRoom(roomId);
    await this.requireHost(room, userId);
    const now = new Date();
    const members = await this.getActiveMembers(room.id);
    for (const member of members) {
      this.settleMember(member, now);
      member.isFocused = false;
      member.focusStartedAt = null;
      member.lastSeenAt = now;
      member.leftAt = now;
    }
    if (members.length) await this.members.save(members);
    room.status = 'closed';
    room.closedAt = now;
    room.timerStatus = 'idle';
    room.phaseStartedAt = null;
    room.phaseEndsAt = null;
    room.pausedRemainingSeconds = null;
    room.lastActiveAt = now;
    await this.rooms.save(room);
  }

  private async findRoom(roomId: number): Promise<PlatformFocusRoomEntity> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: ['hostUser'],
    });
    if (!room || room.status !== 'open')
      throw new NotFoundException('房间不存在或已经结束');
    return room;
  }

  private async findMembership(
    roomId: number,
    userId: number,
  ): Promise<PlatformFocusRoomMemberEntity | null> {
    return this.members.findOne({
      where: { room: { id: roomId }, user: { id: userId }, leftAt: IsNull() },
      relations: ['user'],
    });
  }

  private async requireMembership(
    room: PlatformFocusRoomEntity,
    userId: number,
  ): Promise<PlatformFocusRoomMemberEntity> {
    const membership = await this.findMembership(room.id, userId);
    if (!membership) throw new ForbiddenException('请先加入这个房间');
    return membership;
  }

  private async requireHost(
    room: PlatformFocusRoomEntity,
    userId: number,
  ): Promise<void> {
    if (room.hostUserId !== userId)
      throw new ForbiddenException('只有房主可以控制房间计时');
    await this.requireMembership(room, userId);
  }

  private async getActiveMembers(
    roomId: number,
  ): Promise<PlatformFocusRoomMemberEntity[]> {
    return this.members.find({
      where: { room: { id: roomId }, leftAt: IsNull() },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }

  private async toSummary(
    room: PlatformFocusRoomEntity,
    userId: number,
    now: Date,
  ): Promise<FocusRoomSummary> {
    await this.syncTimer(room, now);
    const [memberCount, membership] = await Promise.all([
      this.members.count({
        where: { room: { id: room.id }, leftAt: IsNull() },
      }),
      this.findMembership(room.id, userId),
    ]);
    return this.toSummaryView(
      room,
      userId,
      memberCount,
      Boolean(membership),
      now,
    );
  }

  private toSummaryView(
    room: PlatformFocusRoomEntity,
    userId: number,
    memberCount: number,
    isMember: boolean,
    now: Date,
  ): FocusRoomSummary {
    return {
      id: String(room.id),
      joinCode: room.joinCode,
      name: room.name,
      isPublic: room.isPublic,
      shareFocusData: room.shareFocusData,
      hostName: displayName(room.hostUser),
      memberCount,
      maxMembers: MAX_MEMBERS,
      isMember,
      isHost: room.hostUserId === userId,
      timerStatus: room.timerStatus,
      phase: room.phase,
      remainingSeconds: this.remainingSeconds(room, now),
      completedRounds: room.completedRounds,
      updatedAt: room.lastActiveAt.toISOString(),
    };
  }

  private async toRoomView(
    room: PlatformFocusRoomEntity,
    userId: number,
    membership: PlatformFocusRoomMemberEntity | null,
    activeMembers: PlatformFocusRoomMemberEntity[],
    now: Date,
  ): Promise<FocusRoomView> {
    const decorations = await this.showcase.getPublicDecorations(
      activeMembers.map((member) => member.userId),
    );
    const summary = this.toSummaryView(
      room,
      userId,
      activeMembers.length,
      Boolean(membership),
      now,
    );
    const members = activeMembers
      .map((member) =>
        this.toMemberView(
          member,
          room,
          decorations.get(member.userId),
          userId,
          now,
        ),
      )
      .sort(
        (left, right) => (right.focusSeconds ?? 0) - (left.focusSeconds ?? 0),
      );
    return {
      ...summary,
      serverTime: now.toISOString(),
      settings: {
        workMinutes: room.workMinutes,
        shortBreakMinutes: room.shortBreakMinutes,
        longBreakMinutes: room.longBreakMinutes,
        roundsBeforeLongBreak: room.roundsBeforeLongBreak,
      },
      timer: {
        status: room.timerStatus,
        phase: room.phase,
        phaseStartedAt: room.phaseStartedAt?.toISOString() ?? null,
        phaseEndsAt: room.phaseEndsAt?.toISOString() ?? null,
        remainingSeconds: this.remainingSeconds(room, now),
        completedRounds: room.completedRounds,
      },
      members,
      currentUser: membership
        ? (members.find((member) => member.userId === String(userId)) ?? null)
        : null,
    };
  }

  private toMemberView(
    member: PlatformFocusRoomMemberEntity,
    room: PlatformFocusRoomEntity,
    decoration: PublicProfileDecoration | undefined,
    viewerUserId: number,
    now: Date,
  ): FocusRoomMemberView {
    const isLive =
      now.getTime() - member.lastSeenAt.getTime() <= PRESENCE_TIMEOUT_MS;
    const visible = room.shareFocusData || member.userId === viewerUserId;
    const seconds = visible ? this.memberFocusSeconds(member, now) : null;
    return {
      id: String(member.id),
      userId: String(member.userId),
      displayName: displayName(member.user),
      avatarUrl: member.user?.photo?.path ?? null,
      titleLabel: decoration?.titleLabel ?? '初来乍到',
      badgeLabel: decoration?.badgeLabel ?? '席定新星',
      isHost: member.userId === room.hostUserId,
      isFocused: visible ? member.isFocused && isLive : null,
      focusSeconds: seconds,
      focusMinutesLabel: seconds === null ? null : formatFocusDuration(seconds),
      lastSeenAt: member.lastSeenAt.toISOString(),
    };
  }

  private async syncTimer(
    room: PlatformFocusRoomEntity,
    now: Date,
  ): Promise<void> {
    if (room.timerStatus !== 'running' || !room.phaseEndsAt) return;
    let changed = false;
    let transitions = 0;
    while (
      room.timerStatus === 'running' &&
      room.phaseEndsAt &&
      room.phaseEndsAt.getTime() <= now.getTime() &&
      transitions < 12
    ) {
      const boundary: Date = room.phaseEndsAt;
      if (room.phase === 'focus') {
        room.completedRounds += 1;
        room.phase =
          room.completedRounds % room.roundsBeforeLongBreak === 0
            ? 'long_break'
            : 'short_break';
      } else {
        room.phase = 'focus';
      }
      room.phaseStartedAt = boundary;
      room.phaseEndsAt = new Date(
        boundary.getTime() + this.phaseDurationSeconds(room) * 1000,
      );
      changed = true;
      transitions += 1;
    }
    if (changed) {
      room.lastActiveAt = now;
      await this.rooms.save(room);
    }
  }

  private phaseDurationSeconds(room: PlatformFocusRoomEntity): number {
    if (room.phase === 'long_break') return room.longBreakMinutes * 60;
    if (room.phase === 'short_break') return room.shortBreakMinutes * 60;
    return room.workMinutes * 60;
  }

  private remainingSeconds(room: PlatformFocusRoomEntity, now: Date): number {
    if (room.timerStatus === 'paused') return room.pausedRemainingSeconds ?? 0;
    if (room.timerStatus !== 'running' || !room.phaseEndsAt) return 0;
    return Math.max(
      0,
      Math.ceil((room.phaseEndsAt.getTime() - now.getTime()) / 1000),
    );
  }

  private memberFocusSeconds(
    member: PlatformFocusRoomMemberEntity,
    now: Date,
  ): number {
    if (!member.isFocused || !member.focusStartedAt) return member.focusSeconds;
    const end = Math.min(
      now.getTime(),
      member.lastSeenAt.getTime() + FOCUS_GRACE_MS,
    );
    return (
      member.focusSeconds +
      Math.max(0, Math.floor((end - member.focusStartedAt.getTime()) / 1000))
    );
  }

  private settleMember(member: PlatformFocusRoomMemberEntity, now: Date): void {
    if (!member.isFocused || !member.focusStartedAt) return;
    const end = Math.min(
      now.getTime(),
      member.lastSeenAt.getTime() + FOCUS_GRACE_MS,
    );
    member.focusSeconds += Math.max(
      0,
      Math.floor((end - member.focusStartedAt.getTime()) / 1000),
    );
    member.focusStartedAt = new Date(end);
  }

  private async createJoinCode(
    repository: Repository<PlatformFocusRoomEntity>,
  ): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const bytes = randomBytes(ROOM_CODE_LENGTH);
      const code = Array.from(
        bytes,
        (value) => alphabet[value % alphabet.length],
      ).join('');
      const exists = await repository.findOne({ where: { joinCode: code } });
      if (!exists) return code;
    }
    throw new UnprocessableEntityException('暂时无法创建房间，请稍后再试');
  }
}

function displayName(user: UserEntity | null | undefined): string {
  const value = [user?.firstName, user?.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .trim();
  return value || '席定同学';
}

function formatFocusDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}
