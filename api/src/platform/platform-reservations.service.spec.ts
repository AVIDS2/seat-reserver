import { describe, expect, it, jest } from '@jest/globals';
import { PlatformReservationsService } from './platform-reservations.service';

type SchoolResponse = {
  httpStatus: number;
  payload: { status: string | boolean; code?: string; data?: unknown };
  message: string;
  success?: boolean;
};

type GetFunction = (
  token: string,
  mode: 'direct' | 'webvpn',
  path: string,
  serviceType: 'study_room' | 'library',
) => Promise<SchoolResponse>;

type BookFunction = (
  token: string,
  mode: 'direct' | 'webvpn',
  date: string,
  candidate: { seatId: string; startTime: number; endTime: number },
  timeoutMs: number,
  serviceType: 'study_room' | 'library',
) => Promise<SchoolResponse>;

type CreateCaptchaFunction = () => Promise<{
  image: string;
  wordImage: string;
  requiredClicks: number;
  token: string;
}>;

type VerifyCaptchaFunction = (
  token: string,
  challengeToken: string,
  points: Array<{ x: number; y: number }>,
) => Promise<SchoolResponse>;

function makeService(
  get: jest.MockedFunction<GetFunction> = jest.fn<GetFunction>(),
  runs?: { find: jest.Mock },
) {
  const account = { id: 4, userId: 7, label: '我的账号' };
  const accounts = {
    findOwned: jest.fn<
      (userId: number, accountId: number) => Promise<typeof account>
    >(() => Promise.resolve(account)),
  };
  const connections = {
    ensureReady: jest.fn(() =>
      Promise.resolve({
        account,
        token: 'hidden-token',
        mode: 'direct' as const,
        serviceType: 'study_room' as const,
      }),
    ),
  };
  const schoolAuth = {
    get,
    book: jest.fn<BookFunction>(),
    createBookingCaptcha: jest.fn<CreateCaptchaFunction>(),
    verifyBookingCaptcha: jest.fn<VerifyCaptchaFunction>(),
  };
  const catalog = {
    invalidateAccount: jest.fn(),
  };
  const redis = {
    setJson: jest.fn(),
    getJson: jest.fn<(key: string) => Promise<unknown>>(),
    delete: jest.fn(),
  };
  const solver = {
    isConfigured: jest.fn(() => false),
    solve: jest.fn(),
    describeProviders: jest.fn(() => []),
  };
  return {
    service: new PlatformReservationsService(
      accounts as never,
      connections as never,
      schoolAuth as never,
      catalog as never,
      redis as never,
      solver as never,
      runs as never,
    ),
    accounts,
    connections,
    schoolAuth,
    redis,
    solver,
  };
}

function response(data: unknown) {
  return {
    httpStatus: 200,
    payload: { status: 'success', code: '0', data },
    message: '',
  };
}

describe('PlatformReservationsService', () => {
  it('should normalize the captured history response and preserve reservation status', async () => {
    const get = jest.fn<GetFunction>(() =>
      Promise.resolve(
        response({
          count: 2,
          reservations: [
            {
              id: 735563,
              receipt: '0114-563-4',
              date: '2026-9-3',
              begin: '14:00',
              end: '15:00',
              loc: '5号楼1层5号楼智能自习室030号',
              stat: 'RESERVE',
            },
            {
              id: 735058,
              receipt: '0114-058-3',
              date: '2026-9-2',
              begin: '11:43',
              end: '19:00',
              loc: '5号楼1层5号楼智能自习室116号',
              stat: 'COMPLETE',
            },
          ],
        }),
      ),
    );
    const { service, accounts } = makeService(get);

    await expect(service.list(7, 4, 'study_room')).resolves.toEqual([
      expect.objectContaining({
        id: '735563',
        date: '2026-09-03',
        location: '5号楼1层5号楼智能自习室030号',
        status: 'upcoming',
        canCancel: true,
      }),
      expect.objectContaining({
        id: '735058',
        status: 'completed',
        canCancel: false,
      }),
    ]);
    expect(accounts.findOwned).toHaveBeenCalledWith(7, 4);
    expect(get).toHaveBeenCalledWith(
      'hidden-token',
      'direct',
      '/rest/v2/history/1/50?page=1&pageSize=50',
      'study_room',
    );
  });

  it('should show successful platform runs when the school history endpoint is unavailable', async () => {
    const get = jest.fn<GetFunction>(() =>
      Promise.reject(new Error('学校系统维护中')),
    );
    const runs = {
      find: jest.fn(() =>
        Promise.resolve([
          {
            id: 88,
            receipt: 'platform-receipt',
            targetDate: '2026-09-13',
            reservedBegin: '08:00',
            reservedEnd: '12:00',
            location: '5号楼智能自习室044号',
            schoolAccount: { label: '我的账号' },
            task: { primarySeatLabel: '044' },
          },
        ]),
      ) as unknown as jest.Mock,
    };
    const { service } = makeService(get, runs);

    await expect(service.list(7, 4, 'study_room')).resolves.toEqual([
      expect.objectContaining({
        id: 'platform-run-88',
        date: '2026-09-13',
        status: 'upcoming',
        statusLabel: '平台记录，学校状态待同步',
        canCancel: false,
      }),
    ]);
    expect(runs.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: { id: 7 },
          schoolAccount: { id: 4 },
          task: { venueType: 'study_room' },
        }),
      }),
    );
  });

  it('should cancel an owned upcoming reservation and refresh the school record', async () => {
    let historyCalls = 0;
    const get = jest.fn<GetFunction>(
      (_: string, __: 'direct' | 'webvpn', path: string) => {
        if (path.includes('/cancel/'))
          return Promise.resolve(response({ id: 735563 }));
        historyCalls += 1;
        return Promise.resolve(
          response({
            reservations: [
              {
                id: 735563,
                receipt: '0114-563-4',
                date: '2026-9-3',
                begin: '14:00',
                end: '15:00',
                loc: '5号楼1层5号楼智能自习室030号',
                stat: historyCalls === 1 ? 'RESERVE' : 'CANCEL',
              },
            ],
          }),
        );
      },
    );
    const { service } = makeService(get);

    await expect(service.cancel(7, 4, 'study_room', '735563')).resolves.toEqual(
      expect.objectContaining({
        id: '735563',
        status: 'cancelled',
        canCancel: false,
      }),
    );
    expect(get).toHaveBeenCalledWith(
      'hidden-token',
      'direct',
      '/rest/v2/cancel/735563',
      'study_room',
    );
  });

  it('should submit an immediate booking with the selected time and seat', async () => {
    const { service, schoolAuth } = makeService();
    schoolAuth.book.mockResolvedValue(
      response({
        id: 735600,
        receipt: '0114-600-1',
        onDate: '2026年09月04日',
        begin: '08:00',
        end: '10:00',
        location: '5号楼1层5号楼智能自习室044号',
        checkedIn: false,
      }),
    );

    await expect(
      service.book(7, {
        accountId: 4,
        serviceType: 'study_room',
        seatId: '197',
        date: '2026-09-04',
        startTime: 480,
        endTime: 600,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: '735600',
        date: '2026-09-04',
        status: 'upcoming',
        canCancel: true,
      }),
    );
    expect(schoolAuth.book).toHaveBeenCalledWith(
      'hidden-token',
      'direct',
      '2026-09-04',
      { seatId: '197', startTime: 480, endTime: 600 },
      10_000,
      'study_room',
    );
  });

  it('should create a short-lived library booking challenge', async () => {
    const { service, schoolAuth, redis } = makeService();
    schoolAuth.createBookingCaptcha.mockResolvedValue({
      image: 'data:image/jpg;base64,aW1hZ2U=',
      wordImage: 'data:image/jpg;base64,d29yZA==',
      requiredClicks: 3,
      token: 'challenge-token-value',
    });

    const challenge = await service.createCaptcha(7, {
      accountId: 4,
      serviceType: 'library',
      seatId: '197',
      date: '2026-09-05',
      startTime: 480,
      endTime: 600,
    });

    expect(challenge).toEqual(
      expect.objectContaining({
        image: 'data:image/jpg;base64,aW1hZ2U=',
        wordImage: 'data:image/jpg;base64,d29yZA==',
        requiredClicks: 3,
      }),
    );
    expect(challenge).not.toHaveProperty('token');
    expect(redis.setJson).toHaveBeenCalledWith(
      expect.stringMatching(/^platform:booking-captcha:/),
      expect.objectContaining({
        userId: 7,
        challengeToken: 'challenge-token-value',
        requiredClicks: 3,
      }),
      180,
    );
  });

  it('should reject non-numeric booking times before contacting the school', async () => {
    const { service, schoolAuth } = makeService();

    await expect(
      service.createCaptcha(7, {
        accountId: 4,
        serviceType: 'library',
        seatId: '197',
        date: '2026-09-05',
        startTime: Number.NaN,
        endTime: 600,
      }),
    ).rejects.toThrow('可预约时间为 07:00–23:00');
    expect(schoolAuth.createBookingCaptcha).not.toHaveBeenCalled();
  });

  it('should enforce the live maximum duration for each reservation service', async () => {
    const { service, schoolAuth } = makeService();

    await expect(
      service.createCaptcha(7, {
        accountId: 4,
        serviceType: 'library',
        seatId: '197',
        date: '2026-09-05',
        startTime: 480,
        endTime: 750,
      }),
    ).rejects.toThrow('图书馆单次预约最长 4 小时');
    expect(schoolAuth.createBookingCaptcha).not.toHaveBeenCalled();
  });

  it('should verify captcha points once and submit the bound booking', async () => {
    const { service, schoolAuth, redis } = makeService();
    redis.getJson.mockResolvedValue({
      userId: 7,
      booking: {
        accountId: 4,
        serviceType: 'library',
        seatId: '197',
        date: '2026-09-05',
        startTime: 480,
        endTime: 600,
      },
      challengeToken: 'challenge-token-value',
      requiredClicks: 2,
    });
    schoolAuth.verifyBookingCaptcha.mockResolvedValue({
      httpStatus: 200,
      payload: { status: 'OK' },
      message: '',
      success: true,
    });
    schoolAuth.book.mockResolvedValue(
      response({
        id: 735601,
        onDate: '2026年09月05日',
        begin: '08:00',
        end: '10:00',
        location: '西太湖校区馆一楼学习空间，座位号001',
      }),
    );

    await expect(
      service.verifyCaptchaAndBook(7, 'challenge-id', [
        { x: 40, y: 80 },
        { x: 120, y: 60 },
      ]),
    ).resolves.toEqual(
      expect.objectContaining({
        id: '735601',
        venueType: 'library',
        status: 'upcoming',
      }),
    );
    expect(redis.delete).toHaveBeenCalledWith(
      'platform:booking-captcha:challenge-id',
    );
    expect(schoolAuth.verifyBookingCaptcha).toHaveBeenCalledWith(
      'hidden-token',
      'challenge-token-value',
      [
        { x: 40, y: 80 },
        { x: 120, y: 60 },
      ],
    );
    expect(schoolAuth.book).toHaveBeenCalledWith(
      'hidden-token',
      'direct',
      '2026-09-05',
      expect.objectContaining({ authId: 'challenge-token-value' }),
      10_000,
      'library',
    );
  });
});
