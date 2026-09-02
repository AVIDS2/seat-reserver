import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { SchoolAuthenticationService } from './school-authentication.service';

describe('SchoolAuthenticationService', () => {
  it('should fall back to WebVPN when direct credentials are not accepted', async () => {
    const directAuthenticate = jest.fn(() =>
      Promise.reject(new UnprocessableEntityException('direct failed')),
    );
    const webVpnAuthenticate = jest.fn<
      (username: string, password: string) => Promise<{ token: string }>
    >(() => Promise.resolve({ token: 'webvpn-token' }));
    const service = new SchoolAuthenticationService(
      { authenticate: directAuthenticate } as never,
      { authenticate: webVpnAuthenticate } as never,
    );

    await expect(service.authenticate('student', 'password')).resolves.toEqual({
      token: 'webvpn-token',
      mode: 'webvpn',
    });
    expect(webVpnAuthenticate).toHaveBeenCalledWith('student', 'password');
  });

  it('should keep direct accounts on the direct authentication path', async () => {
    const directAuthenticate = jest.fn(() =>
      Promise.resolve({ token: 'direct-token', response: {} }),
    );
    const webVpnAuthenticate = jest.fn();
    const service = new SchoolAuthenticationService(
      { authenticate: directAuthenticate } as never,
      { authenticate: webVpnAuthenticate } as never,
    );

    await expect(
      service.authenticate('student', 'password', 'direct'),
    ).resolves.toEqual({ token: 'direct-token', mode: 'direct' });
    expect(webVpnAuthenticate).not.toHaveBeenCalled();
  });

  it('should route verification and booking through WebVPN mode', async () => {
    const webVpnVerify = jest.fn<
      (token: string) => Promise<{ success: boolean }>
    >(() => Promise.resolve({ success: true }));
    const webVpnBook = jest.fn<
      (
        token: string,
        date: string,
        candidate: { seatId: string; startTime: number; endTime: number },
        timeoutMs: number,
      ) => Promise<{ success: boolean }>
    >(() => Promise.resolve({ success: true }));
    const directVerify = jest.fn();
    const directBook = jest.fn();
    const service = new SchoolAuthenticationService(
      { verifyToken: directVerify, book: directBook } as never,
      { verifyToken: webVpnVerify, book: webVpnBook } as never,
    );
    const candidate = { seatId: '197', startTime: 840, endTime: 1320 };

    await service.verifyToken('token', 'webvpn');
    await service.book('token', 'webvpn', '2026-09-03', candidate, 3000);

    expect(webVpnVerify).toHaveBeenCalledWith('token');
    expect(webVpnBook).toHaveBeenCalledWith(
      'token',
      '2026-09-03',
      candidate,
      3000,
    );
    expect(directVerify).not.toHaveBeenCalled();
    expect(directBook).not.toHaveBeenCalled();
  });
});
