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
});
