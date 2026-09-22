import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TimeCandidate } from './entities/booking-task.entity';

type SeatPayload = Record<string, unknown>;

export type SeatResponse = {
  httpStatus: number;
  payload: SeatPayload | null;
  message: string;
  code: string;
  success: boolean;
};

export type SeatCandidate = {
  seatId: string;
  roomId?: string;
  startTime: number;
  endTime: number;
  authId?: string;
  captchaCode?: string;
  captcha?: string;
};

export type SeatServiceType = 'study_room' | 'library';

export function isSuccessfulSeatPayload(
  httpStatus: number,
  payload: SeatPayload | null,
): boolean {
  if (httpStatus !== 200 || !payload) return false;
  const code = payload.code === undefined ? null : String(payload.code);
  if (code !== null && code !== '0') return false;
  return (
    payload.status === 'success' ||
    payload.status === true ||
    payload.status === 'OK'
  );
}

@Injectable()
export class SeatClientService {
  private readonly apiUrl =
    process.env.SEAT_API_URL || 'https://leosys.cn/cczukaoyan/rest/v2/freeBook';
  private readonly authUrl =
    process.env.SEAT_AUTH_URL || 'https://leosys.cn/cczukaoyan/rest/auth';
  private readonly userUrl =
    process.env.SEAT_USER_URL || 'https://leosys.cn/cczukaoyan/rest/v2/user';
  private readonly hmacRequestKey = process.env.SEAT_HMAC_REQUEST_KEY || '';
  private readonly referer =
    process.env.SEAT_REFERER ||
    'https://servicewechat.com/wxd0a21b477b3ac4f2/59/page-frame.html';
  private readonly userAgent =
    process.env.SEAT_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541b37) XWEB/20089';

  async authenticate(
    username: string,
    password: string,
  ): Promise<{ token: string; response: SeatResponse }> {
    const url = new URL(this.authUrl);
    url.searchParams.set('username', username);
    url.searchParams.set('password', password);

    const response = await this.request(url, {
      headers: {
        Actcode: 'true',
        'Content-Type': 'application/json',
      },
    });
    const token =
      response.payload?.data && typeof response.payload.data === 'object'
        ? (response.payload.data as Record<string, unknown>).token
        : undefined;

    if (!response.success || typeof token !== 'string' || !token) {
      throw new UnprocessableEntityException(
        response.message || '学校账号登录失败',
      );
    }

    return { token, response };
  }

  async verifyToken(token: string): Promise<SeatResponse> {
    return this.request(new URL(this.userUrl), { token });
  }

  async book(
    token: string,
    date: string,
    candidate: SeatCandidate,
    timeoutMs: number,
  ): Promise<SeatResponse> {
    const body = new URLSearchParams({
      seat: candidate.seatId,
      date,
      startTime: String(candidate.startTime),
      endTime: String(candidate.endTime),
      authid: candidate.authId || '',
    });

    return this.request(new URL(this.apiUrl), {
      method: 'POST',
      token,
      body,
      timeoutMs,
    });
  }

  async get(token: string, path: string): Promise<SeatResponse> {
    const userUrl = new URL(this.userUrl);
    const servicePrefix = userUrl.pathname.split('/rest/')[0] || '';
    const response = await this.request(
      new URL(`${servicePrefix}${path}`, userUrl.origin),
      { token },
    );
    return response;
  }

  buildCandidates(
    primarySeatId: string,
    backupSeatIds: string[],
    timeCandidates: TimeCandidate[],
  ): SeatCandidate[] {
    const seats = [primarySeatId, ...backupSeatIds].filter(
      (seat, index, all) => seat && all.indexOf(seat) === index,
    );
    return seats.flatMap((seatId) =>
      timeCandidates.map(({ start, end }) => ({
        seatId,
        startTime: start,
        endTime: end,
      })),
    );
  }

  private async request(
    url: URL,
    options: {
      method?: string;
      token?: string;
      headers?: Record<string, string>;
      body?: URLSearchParams;
      timeoutMs?: number;
    },
  ): Promise<SeatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 8000,
    );
    const headers: Record<string, string> = {
      Connection: 'keep-alive',
      'X-request-id': randomUUID(),
      user_ip: '1.1.1.1',
      xweb_xhr: '1',
      loginType: 'APPLET',
      'X-request-date': String(Date.now()),
      'User-Agent': this.userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '*/*',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      Referer: this.referer,
      'Accept-Language': 'zh-CN,zh;q=0.9',
      ...(options.token ? { token: options.token } : {}),
      ...(this.hmacRequestKey
        ? { 'X-hmac-request-key': this.hmacRequestKey }
        : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body,
        signal: controller.signal,
      });
      const raw = await response.text();
      let payload: SeatPayload | null = null;
      try {
        const parsed: unknown = JSON.parse(raw);
        payload =
          parsed && typeof parsed === 'object' ? (parsed as SeatPayload) : null;
      } catch {
        payload = null;
      }

      const message =
        typeof payload?.message === 'string'
          ? payload.message
          : raw.slice(0, 240);
      const code = payload?.code === undefined ? '' : String(payload.code);
      const success = isSuccessfulSeatPayload(response.status, payload);
      return { httpStatus: response.status, payload, message, code, success };
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? '预约接口请求超时'
          : '预约接口暂时不可用';
      throw new ServiceUnavailableException(message);
    } finally {
      clearTimeout(timeout);
    }
  }
}
