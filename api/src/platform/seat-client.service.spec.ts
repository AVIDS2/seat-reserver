import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  isSuccessfulSeatPayload,
  SeatClientService,
} from './seat-client.service';

describe('SeatClientService', () => {
  const previousApiUrl = process.env.SEAT_API_URL;
  const previousAuthUrl = process.env.SEAT_AUTH_URL;
  const previousUserUrl = process.env.SEAT_USER_URL;
  const previousHmac = process.env.SEAT_HMAC_REQUEST_KEY;
  const previousFetch = global.fetch;

  beforeEach(() => {
    process.env.SEAT_API_URL = 'https://example.test/freeBook';
    process.env.SEAT_AUTH_URL = 'https://example.test/auth';
    process.env.SEAT_USER_URL = 'https://example.test/user';
    process.env.SEAT_HMAC_REQUEST_KEY = 'test-hmac';
  });

  afterEach(() => {
    for (const [name, value] of Object.entries({
      SEAT_API_URL: previousApiUrl,
      SEAT_AUTH_URL: previousAuthUrl,
      SEAT_USER_URL: previousUserUrl,
      SEAT_HMAC_REQUEST_KEY: previousHmac,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    global.fetch = previousFetch;
  });

  it('should extract a token from the normal auth response', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          code: '0',
          data: { token: 'token-123' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    global.fetch = fetchMock;
    const service = new SeatClientService();

    const result = await service.authenticate('2300906131', 'school-password');

    expect(result.token).toBe('token-123');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://example.test/auth?username=2300906131&password=school-password',
    );
    expect((init?.headers as Record<string, string>).Actcode).toBe('true');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('should build the captured booking request with the token and hmac header', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          code: '0',
          data: { receipt: '0131-600-1' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    global.fetch = fetchMock;
    const service = new SeatClientService();

    const result = await service.book(
      'token-123',
      '2026-09-02',
      { seatId: '197', startTime: 840, endTime: 1320 },
      3000,
    );

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://example.test/freeBook');
    const headers = init?.headers as Record<string, string>;
    expect(headers.token).toBe('token-123');
    expect(headers['X-hmac-request-key']).toBe('test-hmac');
    expect(await (init?.body as URLSearchParams).toString()).toContain(
      'seat=197',
    );
    expect(await (init?.body as URLSearchParams).toString()).toContain(
      'startTime=840',
    );
    expect(await (init?.body as URLSearchParams).toString()).toContain(
      'endTime=1320',
    );
  });

  it('should preserve the service prefix for catalog requests', async () => {
    process.env.SEAT_USER_URL = 'https://leosys.cn/cczukaoyan/rest/v2/user';
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', code: '0', data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    global.fetch = fetchMock;
    const service = new SeatClientService();

    await service.get('token-123', '/rest/v2/free/filters');

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://leosys.cn/cczukaoyan/rest/v2/free/filters',
    );
  });

  it('should accept each successful school response envelope', () => {
    expect(
      isSuccessfulSeatPayload(200, {
        status: 'success',
        code: '0',
        data: {},
      }),
    ).toBe(true);
    expect(
      isSuccessfulSeatPayload(200, { status: true, data: { hours: 8 } }),
    ).toBe(true);
    expect(
      isSuccessfulSeatPayload(200, { status: 'OK', token: 'challenge' }),
    ).toBe(true);
  });

  it('should reject successful-looking envelopes with a business error code', () => {
    expect(
      isSuccessfulSeatPayload(200, {
        status: 'success',
        code: '1',
        message: '验证码错误',
      }),
    ).toBe(false);
    expect(isSuccessfulSeatPayload(503, { status: true })).toBe(false);
  });
});
