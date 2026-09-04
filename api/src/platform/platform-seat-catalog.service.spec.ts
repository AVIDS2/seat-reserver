import { describe, expect, it, jest } from '@jest/globals';
import { PlatformSeatCatalogService } from './platform-seat-catalog.service';

describe('PlatformSeatCatalogService', () => {
  it('should normalize school filters without exposing protocol tuples', async () => {
    const get = jest.fn((...args: unknown[]) => {
      const path = String(args[2]);
      return Promise.resolve({
        success: true,
        payload: path.endsWith('/settings')
          ? { data: { isCaptchaOpen: false } }
          : {
              data: {
                buildings: [[2, '学习中心', 15, '']],
                rooms: [[9, '安静学习区', 2, 3, '']],
                dates: ['2026-09-04'],
                hours: 8,
              },
            },
      });
    });
    const service = new PlatformSeatCatalogService(
      {
        findOwned: jest.fn(() => Promise.resolve({ id: 4, userId: 7 })),
      } as never,
      {
        ensureReady: jest.fn(() =>
          Promise.resolve({
            token: 'hidden',
            mode: 'direct',
            serviceType: 'study_room',
          }),
        ),
      } as never,
      { get } as never,
    );

    await expect(service.filters(7, 4, 'study_room')).resolves.toEqual({
      serviceType: 'study_room',
      buildings: [{ id: '2', name: '学习中心' }],
      rooms: [{ id: '9', name: '安静学习区', buildingId: '2', floor: 3 }],
      dates: ['2026-09-04'],
      captchaRequired: false,
      hours: 8,
      windowStart: 420,
      windowEnd: 1320,
    });
  });

  it('should map coordinates and availability from the live layout shape', async () => {
    const service = new PlatformSeatCatalogService(
      {
        findOwned: jest.fn(() => Promise.resolve({ id: 4, userId: 7 })),
      } as never,
      {
        ensureReady: jest.fn(() =>
          Promise.resolve({
            token: 'hidden',
            mode: 'direct',
            serviceType: 'study_room',
          }),
        ),
      } as never,
      {
        get: jest.fn(() =>
          Promise.resolve({
            success: true,
            payload: {
              data: {
                id: 9,
                name: '安静学习区',
                rows: 2,
                cols: 3,
                layout: {
                  1002: {
                    id: 197,
                    name: '44',
                    type: 'seat',
                    status: 'FREE',
                    enabled: true,
                  },
                },
              },
            },
          }),
        ),
      } as never,
    );

    const layout = await service.layout(7, 4, 'study_room', '9', '2026-09-04');
    expect(layout.nodes[0]).toEqual(
      expect.objectContaining({
        row: 1,
        col: 2,
        id: '197',
        label: '44',
        status: 'available',
      }),
    );
  });

  it('should expose the service window returned by the school settings', async () => {
    const service = new PlatformSeatCatalogService(
      {
        findOwned: jest.fn(() => Promise.resolve({ id: 4, userId: 7 })),
      } as never,
      {
        ensureReady: jest.fn(() =>
          Promise.resolve({
            token: 'hidden',
            mode: 'webvpn',
            serviceType: 'library',
          }),
        ),
      } as never,
      {
        get: jest.fn((...args: unknown[]) => {
          const path = String(args[2]);
          return Promise.resolve({
            success: true,
            payload: path.endsWith('/settings')
              ? {
                  status: true,
                  data: {
                    buildingOpenClose: [
                      [1, '07:00', '23:00'],
                      [3, '07:00', '23:00'],
                    ],
                    isCaptchaOpen: true,
                  },
                }
              : {
                  status: 'success',
                  code: '0',
                  data: {
                    buildings: [[1, '西太湖校区馆']],
                    rooms: [[11, '二楼北区', 1, 2]],
                    dates: ['2026-09-05'],
                    hours: 4,
                  },
                },
          });
        }),
      } as never,
    );

    await expect(service.filters(7, 4, 'library')).resolves.toEqual(
      expect.objectContaining({
        captchaRequired: true,
        hours: 4,
        windowStart: 420,
        windowEnd: 1380,
      }),
    );
  });

  it('should reuse a short-lived catalog cache and bypass it on refresh', async () => {
    const get = jest.fn((...args: unknown[]) => {
      const path = String(args[2]);
      return Promise.resolve({
        success: true,
        payload: path.endsWith('/settings')
          ? { data: { isCaptchaOpen: false } }
          : { data: { buildings: [], rooms: [], dates: [], hours: 8 } },
      });
    });
    const service = new PlatformSeatCatalogService(
      {
        findOwned: jest.fn(() => Promise.resolve({ id: 4, userId: 7 })),
      } as never,
      {
        ensureReady: jest.fn(() =>
          Promise.resolve({
            token: 'hidden',
            mode: 'direct',
            serviceType: 'study_room',
          }),
        ),
      } as never,
      { get } as never,
    );

    await Promise.all([
      service.filters(7, 4, 'study_room'),
      service.filters(7, 4, 'study_room'),
    ]);
    expect(get).toHaveBeenCalledTimes(2);

    await service.filters(7, 4, 'study_room', true);
    expect(get).toHaveBeenCalledTimes(4);
  });
});
