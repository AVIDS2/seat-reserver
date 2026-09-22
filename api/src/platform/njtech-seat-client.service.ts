import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createCipheriv, randomUUID } from 'node:crypto';
import { load } from 'cheerio';
import makeFetchCookie, { type FetchCookieImpl } from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { PlatformCaptchaSolverService } from './platform-captcha-solver.service';
import type { WebVpnSessionState } from './webvpn-seat-client.service';
import type { SeatCandidate, SeatResponse } from './seat-client.service';

type CookieFetch = FetchCookieImpl<RequestInfo | URL, RequestInit, Response>;
type JsonRecord = Record<string, unknown>;

type NjtechSession = {
  client: CookieFetch;
  jar: CookieJar;
  proxyBase: string;
  targetOrigin: string;
  targetReferer: string;
  expiresAt: number;
  userId?: string;
  username?: string;
  seatLibraries: Map<string, number>;
};

const TARGET_ORIGIN = 'https://seat.njtech.edu.cn';
const DEFAULT_ENTRY_URL =
  'https://vpnlib.njtech.edu.cn/enlink/sso/login?redirectUrl=' +
  encodeURIComponent(`${TARGET_ORIGIN}/index.php/reserve/index.html`);

const LIST_QUERY = `query list {
  userAuth {
    reserve {
      libs(libType: -1) {
        lib_id lib_floor is_open lib_name lib_type lib_group_id lib_comment
        lib_rt { seats_total seats_used seats_booking seats_has reserve_ttl open_time open_time_str close_time close_time_str advance_booking }
      }
      libGroups { id group_name }
      reserve { isRecordUser }
    }
    record { libs { lib_id lib_floor is_open lib_name lib_type lib_group_id lib_comment lib_color_name
      lib_rt { seats_total seats_used seats_booking seats_has reserve_ttl open_time open_time_str close_time close_time_str advance_booking }
    } }
    rule { signRule }
  }
}
`;

const INDEX_QUERY = `query index($pos: String!, $param: [hash]) {
  userAuth {
    reserve {
      reserve { token status user_id user_nick sch_name lib_id lib_name lib_floor seat_key seat_name date exp_date exp_date_str validate_date hold_date diff diff_str mark_source isRecordUser isChooseSeat isRecord mistakeNum openTime threshold daynum closeTime timerange forbidQrValid renewTimeNext forbidRenewTime forbidWechatCancle }
      getSToken
    }
    currentUser { user_id user_nick user_mobile user_sex user_sch_id user_sch user_last_login user_avatar(size: MIDDLE) user_adate user_student_no user_student_name area_name user_deny { deny_deadline } sch { sch_id sch_name activityUrl isShowCommon isBusy } subscribe_remind }
  }
}
`;

const LIB_LAYOUT_QUERY = `query libLayout($libId: Int, $libType: Int) {
  userAuth { reserve { libs(libType: $libType, libId: $libId) {
    lib_id is_open lib_floor lib_name lib_type
    lib_layout { seats_total seats_booking seats_used max_x max_y seats { x y key type name seat_status status } }
  } } }
}
`;

const CANCEL_MUTATION = `mutation reserveCancle($sToken: String!) {
  userAuth { reserve { reserveCancle(sToken: $sToken) { timerange img hours mins per } } }
}
`;

const RESERVE_MUTATION = `mutation reserueSeat($libId: Int!, $seatKey: String!, $captchaCode: String, $captcha: String!) {
  userAuth { reserve { reserueSeat(libId: $libId, seatKey: $seatKey, captchaCode: $captchaCode, captcha: $captcha) } }
}
`;

@Injectable()
export class NjtechSeatClientService {
  private readonly sessions = new Map<string, NjtechSession>();
  private readonly gateway = new URL(
    process.env.NJTECH_WEBVPN_URL || 'https://vpnlib.njtech.edu.cn',
  );
  private readonly entryUrl =
    process.env.NJTECH_WEBVPN_ENTRY_URL || DEFAULT_ENTRY_URL;
  private readonly timeoutMs = numberSetting(
    process.env.NJTECH_WEBVPN_TIMEOUT_MS,
    20_000,
  );

  constructor(private readonly captchaSolver: PlatformCaptchaSolverService) {}

  async authenticate(
    username: string,
    password: string,
  ): Promise<{ token: string; session: WebVpnSessionState }> {
    const jar = new CookieJar();
    const client: CookieFetch = makeFetchCookie(fetch, jar, false);
    const entry = await this.fetchFollowing(client, new URL(this.entryUrl));
    let current = entry;

    if (current.url.pathname.includes('/enlink/sso/login')) {
      const html = await current.response.text();
      const oauthUrl = parseOauthUrl(html, current.url);
      if (!oauthUrl) {
        throw new ServiceUnavailableException('南工大统一认证入口格式已变化');
      }
      current = await this.fetchFollowing(client, oauthUrl);
    }

    if (isCasLoginPage(current.url)) {
      current = await this.submitCasLogin(client, current, username, password);
    }

    let proxyBase = extractNjtechProxyBase(current.url, this.gateway);
    if (!proxyBase) proxyBase = await this.resolveProxyAfterLogin(client, jar);
    if (!proxyBase) {
      throw new ServiceUnavailableException('南工大座位系统代理入口无效');
    }

    const token = `njtech:${randomUUID()}`;
    const session: NjtechSession = {
      client,
      jar,
      proxyBase,
      targetOrigin: TARGET_ORIGIN,
      targetReferer: `${TARGET_ORIGIN}/web/index.html`,
      expiresAt: Date.now() + 30 * 60 * 1000,
      seatLibraries: new Map(),
    };
    this.sessions.set(token, session);
    const verified = await this.verifyToken(token);
    if (!verified.success) {
      this.sessions.delete(token);
      throw new UnprocessableEntityException(
        verified.message || '南工大座位系统认证失败',
      );
    }
    return { token, session: this.getSessionState(token)! };
  }

  async verifyToken(token: string): Promise<SeatResponse> {
    const result = await this.graphql(token, 'index', INDEX_QUERY, {
      pos: 'home',
    });
    if (result.success) {
      const data = record(record(result.payload?.data).userAuth);
      const user = record(data.currentUser);
      const session = this.sessions.get(token);
      if (session) {
        session.userId = stringValue(user.user_id);
        session.username = stringValue(user.user_student_no);
      }
    }
    return result;
  }

  async get(token: string, path: string): Promise<SeatResponse> {
    if (path.includes('/free/filters')) return this.getFilters(token);
    if (path.includes('/settings')) return this.getSettings(token);
    if (path.includes('/room/layoutByDate/')) {
      const match = path.match(/layoutByDate\/([^/]+)/);
      return this.getLayout(token, match?.[1] || '');
    }
    if (path.includes('/history/')) return this.getHistory(token);
    if (path.includes('/cancel/')) {
      const id = decodeURIComponent(path.split('/cancel/')[1] || '');
      return this.cancel(token, id);
    }
    if (
      path.includes('/startTimesForSeat/') ||
      path.includes('/endTimesForSeat/')
    ) {
      return this.getTimes(token, path);
    }
    return this.verifyToken(token);
  }

  async book(
    token: string,
    _date: string,
    candidate: SeatCandidate,
  ): Promise<SeatResponse> {
    const session = this.requireSession(token);
    const libId = Number(
      candidate.roomId || session.seatLibraries.get(candidate.seatId),
    );
    if (!Number.isInteger(libId) || libId <= 0) {
      return failure(422, '南工大预约缺少空间编号');
    }
    const result = await this.graphql(token, 'reserueSeat', RESERVE_MUTATION, {
      libId,
      seatKey: candidate.seatId,
      captchaCode: candidate.captchaCode || '',
      captcha: candidate.captcha || '',
    });
    const errors = result.payload?.errors;
    if (Array.isArray(errors) && errors.length) {
      const first = record(errors[0]);
      return failure(
        200,
        stringValue(first.msg) || '南工大预约失败',
        Number(first.code || 1),
      );
    }
    const booked = record(
      record(record(result.payload?.data).userAuth).reserve,
    ).reserueSeat;
    if (booked === false) return failure(200, '南工大预约失败');
    return result;
  }

  getSessionState(token: string): WebVpnSessionState | null {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    const cookieJar = session.jar.toJSON();
    if (!cookieJar) return null;
    return {
      provider: 'njtech',
      proxyBase: session.proxyBase,
      targetOrigin: session.targetOrigin,
      targetReferer: session.targetReferer,
      signingSecret: '',
      expiresAt: session.expiresAt,
      cookieJar,
      userId: session.userId,
      username: session.username,
    };
  }

  restoreSession(token: string, state: WebVpnSessionState): boolean {
    if (
      state.provider !== 'njtech' ||
      !state.cookieJar ||
      state.expiresAt <= Date.now()
    )
      return false;
    try {
      const jar = CookieJar.fromJSON(state.cookieJar);
      const client: CookieFetch = makeFetchCookie(fetch, jar, false);
      this.sessions.set(token, {
        client,
        jar,
        proxyBase: state.proxyBase,
        targetOrigin: state.targetOrigin,
        targetReferer: state.targetReferer,
        expiresAt: state.expiresAt,
        userId: state.userId,
        username: state.username,
        seatLibraries: new Map(),
      });
      return true;
    } catch {
      return false;
    }
  }

  private async getFilters(token: string): Promise<SeatResponse> {
    const result = await this.graphql(token, 'list', LIST_QUERY);
    if (!result.success) return result;
    const data = record(record(record(result.payload?.data).userAuth).reserve);
    const libs = arrayOfRecords(data.libs);
    const groups = arrayOfRecords(data.libGroups);
    const groupNames = new Map(
      groups.map((item) => [String(item.id), String(item.group_name || '')]),
    );
    const buildings = [
      ...new Set(
        libs.map((item) => String(item.lib_group_id || '')).filter(Boolean),
      ),
    ].map((id) => [id, groupNames.get(id) || `馆区 ${id}`]);
    const rooms = libs.map((item) => [
      String(item.lib_id),
      String(item.lib_name || '未命名空间'),
      String(item.lib_group_id || ''),
      floorNumber(item.lib_floor),
    ]);
    const hours =
      Number(
        record(libs[0]?.lib_rt)
          .close_time_str?.toString()
          .match(/\d{1,2}/)?.[0] || 22,
      ) -
      Number(
        record(libs[0]?.lib_rt)
          .open_time_str?.toString()
          .match(/\d{1,2}/)?.[0] || 8,
      );
    return success({
      buildings,
      rooms,
      dates: [shanghaiDate()],
      hours,
      isCaptchaOpen: false,
      groups,
      signRule: String(
        record(record(record(result.payload?.data).userAuth).rule).signRule ||
          '',
      ),
    });
  }

  private async getSettings(token: string): Promise<SeatResponse> {
    const result = await this.getFilters(token);
    const data = record(result.payload?.data);
    return success({
      buildingOpenClose: [[1, '08:00', '22:00']],
      isCaptchaOpen: false,
      source: data,
    });
  }

  private async getLayout(
    token: string,
    roomId: string,
  ): Promise<SeatResponse> {
    const result = await this.graphql(token, 'libLayout', LIB_LAYOUT_QUERY, {
      libId: Number(roomId),
      libType: 0,
    });
    if (!result.success) return result;
    const userAuth = record(record(result.payload?.data).userAuth);
    const libs = arrayOfRecords(record(userAuth.reserve).libs);
    const lib = libs[0];
    const layout = record(lib?.lib_layout);
    const session = this.requireSession(token);
    const seats = Array.isArray(layout.seats) ? layout.seats : [];
    const mapped: Record<string, unknown> = {};
    for (const raw of seats) {
      const item = record(raw);
      const key = String(item.key || '');
      if (!key) continue;
      if (Number(item.type) === 1)
        session.seatLibraries.set(key, Number(lib?.lib_id));
      mapped[key] = {
        type: Number(item.type) === 1 ? 'seat' : 'decoration',
        id: Number(item.type) === 1 ? key : null,
        name: String(item.name || ''),
        status:
          Number(item.seat_status) === 1
            ? 'FREE'
            : Number(item.seat_status) > 0
              ? 'BOOKED'
              : 'UNAVAILABLE',
        enabled: Number(item.type) === 1,
        x: Number(item.x || 0),
        y: Number(item.y || 0),
      };
    }
    return success({
      layout: mapped,
      id: lib?.lib_id,
      name: lib?.lib_name,
      rows: Number(layout.max_y || 0),
      cols: Number(layout.max_x || 0),
    });
  }

  private getTimes(_token: string, path: string): SeatResponse {
    const starts = [{ id: '480', label: '08:00' }];
    const ends = [{ id: '1320', label: '22:00' }];
    return success(
      path.includes('/startTimesForSeat/')
        ? { startTimes: starts }
        : { endTimes: ends },
    );
  }

  private async getHistory(token: string): Promise<SeatResponse> {
    const result = await this.graphql(token, 'index', INDEX_QUERY, {
      pos: 'home',
    });
    if (!result.success) return result;
    const data = record(record(result.payload?.data).userAuth);
    const reserve = record(record(data.reserve).reserve);
    const reservations = reserve.token
      ? [
          {
            id: String(reserve.token),
            stat: Number(reserve.status) === 1 ? 'RESERVE' : 'USING',
            date: timestampDate(reserve.date),
            begin: timestampTime(reserve.date),
            end: timestampTime(reserve.exp_date),
            location:
              `${reserve.lib_name || ''} ${reserve.seat_name || ''}`.trim(),
            receipt: String(reserve.token),
          },
        ]
      : [];
    return success({ reservations });
  }

  private async cancel(token: string, tokenId: string): Promise<SeatResponse> {
    const result = await this.graphql(token, 'reserveCancle', CANCEL_MUTATION, {
      sToken: tokenId,
    });
    if (result.success) {
      const data = record(
        record(record(result.payload?.data).userAuth).reserve,
      ).reserveCancle;
      if (data === null || data === false)
        return failure(200, '南工大取消预约失败');
    }
    return result;
  }

  private async graphql(
    token: string,
    operationName: string,
    query: string,
    variables: JsonRecord = {},
  ): Promise<SeatResponse> {
    const session = this.requireSession(token);
    const url = new URL(`${session.proxyBase}/index.php/graphql/`);
    url.search = '?enlink-vpn';
    try {
      const response = await session.client(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          Referer: session.targetReferer,
          Origin: session.targetOrigin,
        },
        body: JSON.stringify({ operationName, query, variables }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const raw = await response.text();
      const payload = JSON.parse(raw) as JsonRecord;
      const errors = Array.isArray(payload.errors) ? payload.errors : [];
      return {
        httpStatus: response.status,
        payload,
        message: errors.length
          ? String(
              record(errors[0]).msg ||
                record(errors[0]).message ||
                'GraphQL 请求失败',
            )
          : 'success',
        code: errors.length ? String(record(errors[0]).code || '1') : '0',
        success: response.ok && errors.length === 0,
      };
    } catch (error) {
      return failure(
        0,
        error instanceof Error ? error.message : '南工大座位服务暂时不可用',
      );
    }
  }

  private requireSession(token: string): NjtechSession {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      throw new ServiceUnavailableException('南工大 WebVPN 会话已过期');
    }
    return session;
  }

  private async submitCasLogin(
    client: CookieFetch,
    page: FollowResult,
    username: string,
    password: string,
  ): Promise<FollowResult> {
    const html = await page.response.text();
    const $ = load(html);
    const form = $('form')
      .filter((_, el) => $(el).find('input[name="username"]').length > 0)
      .first();
    const fields = new URLSearchParams();
    if (form.length) {
      form.find('input[name]').each((_, el) => {
        const name = $(el).attr('name');
        if (name) fields.set(name, $(el).attr('value') || '');
      });
    }
    const croypto = $('#login-croypto').text().trim();
    const flowKey = $('#login-page-flowkey').text().trim();
    const isDynamicCasPage = !form.length && Boolean(croypto && flowKey);
    if (!form.length && !isDynamicCasPage) {
      throw new UnprocessableEntityException('南工大统一认证页面格式已变化');
    }

    // The current CAS page renders its form in Angular after the initial HTML
    // response, but the browser still submits the same server-side fields.
    if (isDynamicCasPage) {
      fields.set('type', 'UsernamePassword');
      fields.set('_eventId', 'submit');
      fields.set('geolocation', '');
      fields.set('execution', flowKey);
    }
    fields.set('username', username);
    if (fields.has('passwordPre')) fields.set('passwordPre', password);
    fields.set('croypto', croypto);
    fields.set('password', desEncrypt(password, croypto));
    fields.set('_eventId', fields.get('_eventId') || 'submit');
    const captchaUrl =
      $('img[src*="captcha"]').attr('src') ||
      '/cas/api/captcha/generate/DEFAULT';
    if (
      fields.has('captcha_code') ||
      html.includes('captcha_code') ||
      html.includes('/captcha/generate')
    ) {
      const image = await this.fetchImage(
        client,
        new URL(captchaUrl, page.url),
      );
      const code = await this.captchaSolver.recognizeText(image);
      fields.set('captcha_code', code);
    }
    const action = new URL(form.attr('action') || 'login', page.url);
    return this.fetchFollowing(client, action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: page.url.toString(),
      },
      body: fields,
    });
  }

  private async resolveProxyAfterLogin(
    client: CookieFetch,
    jar: CookieJar,
  ): Promise<string | null> {
    const cookies = (await jar.getCookies(this.gateway.origin))
      .map((cookie) => `${cookie.key}=${cookie.value}`)
      .join('; ');
    const clientInfo = cookies
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('clientInfo='))
      ?.slice('clientInfo='.length);
    if (!clientInfo) return null;
    let userId = '';
    try {
      const decodedText = decodeURIComponent(clientInfo);
      let decoded: unknown;
      try {
        decoded = JSON.parse(decodedText);
      } catch {
        decoded = JSON.parse(
          Buffer.from(decodedText, 'base64').toString('utf8'),
        );
      }
      userId = stringValue(record(decoded).userId);
    } catch {
      return null;
    }
    if (!userId) return null;
    const response = await this.fetchFollowing(
      client,
      new URL(
        '/enlink/api/client/service/group/treeWithService/',
        this.gateway,
      ),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: this.gateway.origin + '/enlink/',
        },
        body: JSON.stringify({ nameLike: '', serviceNameLike: '', userId }),
      },
    );
    if (!response.response.ok) return null;
    const payload = (await response.response
      .json()
      .catch(() => null)) as unknown;
    const services = findServiceRecords(payload);
    const wanted = services.find((item) => {
      const name = stringValue(item.name);
      const server = stringValue(item.server);
      return name.includes('座位') || server.includes('seat.njtech.edu.cn');
    });
    return wanted
      ? extractNjtechProxyBase(
          new URL(stringValue(wanted.urlPlus)),
          this.gateway,
        )
      : null;
  }

  private async fetchImage(client: CookieFetch, url: URL): Promise<string> {
    const response = await client(url, {
      headers: { Accept: 'image/*', Referer: url.origin },
    });
    if (!response.ok)
      throw new ServiceUnavailableException('南工大登录验证码加载失败');
    const mime = response.headers.get('content-type') || 'image/png';
    return `data:${mime.split(';')[0]};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
  }

  private async fetchFollowing(
    client: CookieFetch,
    initial: URL,
    init: RequestInit = {},
  ): Promise<FollowResult> {
    let url = new URL(initial);
    let method = init.method || 'GET';
    let body = init.body;
    let headers = new Headers(init.headers);
    for (let count = 0; count <= 25; count++) {
      const response = await client(url, {
        ...init,
        method,
        body,
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (![301, 302, 303, 307, 308].includes(response.status))
        return { response, url };
      const location = response.headers.get('location');
      if (!location) return { response, url };
      const next = new URL(location, url);
      if (
        response.status === 303 ||
        ((response.status === 301 || response.status === 302) &&
          method === 'POST')
      ) {
        method = 'GET';
        body = undefined;
        headers = new Headers();
      }
      url = next;
    }
    throw new ServiceUnavailableException('南工大登录跳转次数过多');
  }
}

type FollowResult = { response: Response; url: URL };

function parseOauthUrl(html: string, page: URL): URL | null {
  const match = html.match(/var\s+ssoConf\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1].replace(/\\u0026/g, '&')) as {
      url?: string;
    };
    return value.url ? new URL(value.url, page) : null;
  } catch {
    return null;
  }
}

function isCasLoginPage(url: URL): boolean {
  return (
    url.hostname === 'sfgl.njtech.edu.cn' && url.pathname.includes('/cas/login')
  );
}

function extractNjtechProxyBase(url: URL, gateway: URL): string | null {
  if (url.origin !== gateway.origin) return null;
  if (!url.pathname.startsWith('/https/') && !url.pathname.startsWith('/http/'))
    return null;
  const markers = ['/index.php/', '/web/'];
  const marker = markers
    .map((item) => url.pathname.indexOf(item))
    .filter((item) => item >= 0)
    .sort((a, b) => a - b)[0];
  if (marker === undefined) return null;
  return new URL(url.pathname.slice(0, marker), gateway)
    .toString()
    .replace(/\/$/, '');
}

function desEncrypt(value: string, base64Key: string): string {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 8)
    throw new UnprocessableEntityException('南工大认证密钥无效');
  const cipher = createCipheriv(
    'des-ede3-ecb',
    Buffer.concat([key, key, key]),
    null,
  );
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString(
    'base64',
  );
}

function findServiceRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(findServiceRecords);
  if (!value || typeof value !== 'object') return [];
  const item = value as JsonRecord;
  const own = typeof item.urlPlus === 'string' ? [item] : [];
  return [...own, ...Object.values(item).flatMap(findServiceRecords)];
}

function success(data: JsonRecord): SeatResponse {
  return {
    httpStatus: 200,
    payload: { status: 'success', code: '0', data },
    message: 'success',
    code: '0',
    success: true,
  };
}
function failure(httpStatus: number, message: string, code = 1): SeatResponse {
  return {
    httpStatus,
    payload: { status: 'error', code, message },
    message,
    code: String(code),
    success: false,
  };
}
function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}
function arrayOfRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          !!item && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
}
function stringValue(value: unknown): string {
  return typeof value === 'string'
    ? value
    : value === null || value === undefined
      ? ''
      : String(value);
}
function floorNumber(value: unknown): number {
  const match = stringValue(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}
function numberSetting(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function shanghaiDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
function timestampDate(value: unknown): string {
  if (!value) return '';
  const date = new Date(Number(value) * 1000);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(
        date,
      );
}
function timestampTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(Number(value) * 1000);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
}
