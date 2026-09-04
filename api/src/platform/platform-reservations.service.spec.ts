import { describe, expect, it, jest } from '@jest/globals';
import { PlatformReservationsService } from './platform-reservations.service';

type SchoolResponse = {
  httpStatus: number;
  payload: { status: string; code: string; data: unknown };
  message: string;
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

function makeService(
  get: jest.MockedFunction<GetFunction> = jest.fn<GetFunction>(),
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
  };
  const catalog = {
    invalidateAccount: jest.fn(),
  };
  return {
    service: new PlatformReservationsService(
      accounts as never,
      connections as never,
      schoolAuth as never,
      catalog as never,
    ),
    accounts,
    connections,
    schoolAuth,
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
});
