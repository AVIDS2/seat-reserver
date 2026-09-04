import { describe, expect, it } from '@jest/globals';
import { CookieJar } from 'tough-cookie';
import {
  proxyApiUrl,
  WebVpnSeatClientService,
  type WebVpnSessionState,
} from './webvpn-seat-client.service';

describe('WebVpnSeatClientService session persistence', () => {
  it('should restore a non-expired session from its serialized cookie jar', async () => {
    const jar = new CookieJar();
    await jar.setCookie(
      'ENSSESSIONID=session-value; Domain=zmvpn.cczu.edu.cn; Path=/; Secure',
      'https://zmvpn.cczu.edu.cn/enlink/',
    );
    const state: WebVpnSessionState = {
      proxyBase: 'https://zmvpn.cczu.edu.cn/http/webvpn/example',
      targetOrigin: 'http://202.195.100.14',
      targetReferer: 'http://202.195.100.14/libseat/',
      signingSecret: 'signing-secret',
      expiresAt: Date.now() + 60_000,
      cookieJar: jar.toJSON()!,
    };
    const service = new WebVpnSeatClientService();

    expect(service.restoreSession('business-token', state)).toBe(true);
    expect(service.getSessionState('business-token')).toMatchObject({
      proxyBase: state.proxyBase,
      targetOrigin: state.targetOrigin,
      targetReferer: state.targetReferer,
      signingSecret: state.signingSecret,
    });
  });

  it('should reject an expired persisted session', () => {
    const service = new WebVpnSeatClientService();
    const state = {
      proxyBase: 'https://zmvpn.cczu.edu.cn/http/webvpn/example',
      targetOrigin: 'http://202.195.100.14',
      targetReferer: 'http://202.195.100.14/libseat/',
      signingSecret: 'signing-secret',
      expiresAt: Date.now() - 1,
      cookieJar: new CookieJar().toJSON()!,
    } satisfies WebVpnSessionState;

    expect(service.restoreSession('expired-token', state)).toBe(false);
    expect(service.getSessionState('expired-token')).toBeNull();
  });

  it('should preserve query parameters and use the bare WebVPN flag', () => {
    const url = proxyApiUrl(
      'https://zmvpn.cczu.edu.cn/http/webvpn/example',
      '/rest/v2/history/1/50?page=1',
      'business.token',
    );

    expect(url.search).toBe('?page=1&token=business.token&enlink-vpn');
  });
});
