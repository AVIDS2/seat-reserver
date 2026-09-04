import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { load } from 'cheerio';
import makeFetchCookie, { type FetchCookieImpl } from 'fetch-cookie';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomUUID,
} from 'node:crypto';
import { CookieJar } from 'tough-cookie';
import type { SeatCandidate, SeatResponse } from './seat-client.service';
import type { SeatServiceType } from './entities/school-service-connection.entity';

type CookieFetch = FetchCookieImpl<RequestInfo | URL, RequestInit, Response>;

type FollowResult = {
  response: Response;
  url: URL;
  fragmentToken: string | null;
};

type SeatServiceConfig = {
  name: string;
  server: string;
  urlPlus: string;
  canVisit?: boolean;
  type?: string;
};

type SeatProxy = {
  baseUrl: string;
  serverUrl: string;
};

type SeatAuthResponse = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
  data?: unknown;
};

type WebVpnSession = {
  client: CookieFetch;
  proxyBase: string;
  targetOrigin: string;
  targetReferer: string;
  signingSecret: string;
  expiresAt: number;
  userId?: string;
  username?: string;
};

@Injectable()
export class WebVpnSeatClientService {
  private readonly sessions = new Map<string, WebVpnSession>();
  private readonly gateway = new URL(
    process.env.SEAT_WEBVPN_URL || 'https://zmvpn.cczu.edu.cn',
  );
  private readonly seatAppName =
    process.env.SEAT_WEBVPN_APP_NAME || '图书馆座位预约';
  private readonly seatAppPath = normalizeAppPath(
    process.env.SEAT_WEBVPN_APP_PATH || '/libseat/',
  );
  private readonly studyRoomTargetUrl = new URL(
    process.env.SEAT_WEBVPN_TARGET_URL || 'http://202.195.100.14',
  );
  private readonly libraryTargetUrl = new URL(
    process.env.LIBRARY_WEBVPN_TARGET_URL || 'http://zuowei.cczu.edu.cn',
  );
  private readonly timeoutMs = numberSetting(
    process.env.SEAT_WEBVPN_TIMEOUT_MS,
    15_000,
  );
  private readonly userAgent =
    process.env.SEAT_WEBVPN_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36';

  async authenticate(
    username: string,
    password: string,
    serviceType: SeatServiceType = 'study_room',
  ): Promise<{ token: string }> {
    const jar = new CookieJar();
    const client: CookieFetch = makeFetchCookie(fetch, jar, false);

    try {
      const userId = await this.loginToGateway(client, jar, username, password);
      const portalSeatProxy = await this.resolveSeatProxy(client, userId);
      const seatEntry = await this.fetchFollowing(
        client,
        proxyUrl(portalSeatProxy.baseUrl, this.seatAppPath),
      );
      const targetUrl =
        serviceType === 'library'
          ? this.libraryTargetUrl
          : this.studyRoomTargetUrl;
      const entryMatchesTarget = proxyTargetsOrigin(seatEntry.url, targetUrl);
      const seatPage =
        seatEntry.fragmentToken && entryMatchesTarget
          ? seatEntry
          : await this.startSeatCas(
              client,
              {
                ...portalSeatProxy,
                serverUrl: targetUrl.origin,
              },
              username,
              password,
            );
      const ssoToken = seatPage.fragmentToken;
      if (!ssoToken) {
        throw new UnprocessableEntityException(
          '学校统一认证未返回座位系统授权票据',
        );
      }

      const proxyBase = extractProxyBase(
        seatPage.url,
        this.gateway,
        this.seatAppPath,
      );
      const seatProxy = {
        baseUrl: proxyBase,
        serverUrl: targetUrl.origin,
      };
      const signingSecret = await this.loadSigningSecret(client, proxyBase);
      const businessToken = await this.exchangeSsoToken(
        client,
        seatProxy,
        ssoToken,
        signingSecret,
      );
      this.sessions.set(businessToken, {
        client,
        proxyBase,
        targetOrigin: new URL(seatProxy.serverUrl).origin,
        targetReferer: `${seatProxy.serverUrl}${this.seatAppPath}`,
        signingSecret,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });
      this.pruneSessions();
      return { token: businessToken };
    } catch (error: unknown) {
      if (
        error instanceof UnprocessableEntityException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException('学校 WebVPN 登录暂时不可用');
    }
  }

  async verifyToken(token: string): Promise<SeatResponse> {
    const response = await this.signedSeatRequest(
      token,
      'GET',
      '/rest/v2/user',
    );
    if (response.success) {
      const session = this.sessions.get(token);
      const data = isRecord(response.payload?.data)
        ? response.payload.data
        : null;
      if (session && data) {
        if (data.id !== undefined && data.id !== null) {
          session.userId = String(data.id);
        }
        if (typeof data.username === 'string' && data.username) {
          session.username = data.username;
        }
      }
    }
    return response;
  }

  async book(
    token: string,
    date: string,
    candidate: SeatCandidate,
    timeoutMs: number,
  ): Promise<SeatResponse> {
    let session = this.sessions.get(token);
    if (!session?.userId || !session.username) {
      const verified = await this.verifyToken(token);
      if (!verified.success) return verified;
      session = this.sessions.get(token);
    }

    const body = new FormData();
    body.set('startTime', String(candidate.startTime));
    body.set('endTime', String(candidate.endTime));
    body.set('seat', candidate.seatId);
    body.set('date', date);
    body.set('userId', session?.userId || '');
    body.set('username', session?.username || '');
    body.set('authid', '');
    return this.signedSeatRequest(
      token,
      'POST',
      '/rest/v2/freeBook',
      body,
      timeoutMs,
    );
  }

  async get(token: string, path: string): Promise<SeatResponse> {
    const response = await this.signedSeatRequest(token, 'GET', path);
    return response;
  }

  private async loginToGateway(
    client: CookieFetch,
    jar: CookieJar,
    username: string,
    password: string,
  ): Promise<string> {
    const loginPage = await this.fetchFollowing(
      client,
      new URL('/enlink/sso/login', this.gateway),
    );
    if (!loginPage.response.ok) {
      throw new ServiceUnavailableException('学校 WebVPN 登录页面不可用');
    }
    const loginKey = extractGatewayLoginKey(await loginPage.response.text());
    if (!loginKey) {
      throw new ServiceUnavailableException('学校 WebVPN 登录页面格式已变化');
    }

    const key = Buffer.from(loginKey, 'utf8');
    const iv = Buffer.from(loginKey.split('').reverse().join(''), 'utf8');
    const cipher = createCipheriv('aes-128-cbc', key, iv);
    const encryptedPassword = Buffer.concat([
      cipher.update(Buffer.from(password, 'utf8')),
      cipher.final(),
    ]).toString('base64');
    const loginUrl = new URL('/enlink/sso/login/submit', this.gateway);
    const result = await this.fetchFollowing(client, loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: this.gateway.origin,
        Referer: new URL('/enlink/sso/login', this.gateway).toString(),
      },
      body: new URLSearchParams({
        username,
        password: encryptedPassword,
        token: loginKey,
        language: 'zh-CN,zh;q=0.9,en;q=0.8',
      }),
    });
    if (!result.response.ok && !result.response.redirected) {
      throw new UnprocessableEntityException('学校 WebVPN 账号或密码错误');
    }
    const clientInfoCookie = (
      await jar.getCookies(new URL('/enlink/', this.gateway).toString())
    ).find((cookie) => cookie.key === 'clientInfo');
    if (!clientInfoCookie) {
      const gatewayMessage = await readGatewayLoginMessage(result.response);
      if (gatewayMessage) {
        throw new UnprocessableEntityException(`学校 WebVPN ${gatewayMessage}`);
      }
    }
    return this.initializeGatewaySession(client, jar);
  }

  private async initializeGatewaySession(
    client: CookieFetch,
    jar: CookieJar,
  ): Promise<string> {
    const clientInfoCookie = (
      await jar.getCookies(new URL('/enlink/', this.gateway).toString())
    ).find((cookie) => cookie.key === 'clientInfo');
    if (!clientInfoCookie) {
      throw new UnprocessableEntityException('学校 WebVPN 登录失败');
    }

    let userId = '';
    try {
      const rawClientInfo = decodeURIComponent(clientInfoCookie.value);
      let clientInfo: unknown;
      try {
        clientInfo = JSON.parse(rawClientInfo) as unknown;
      } catch {
        clientInfo = JSON.parse(
          Buffer.from(rawClientInfo, 'base64').toString('utf8'),
        ) as unknown;
      }
      if (isRecord(clientInfo) && typeof clientInfo.userId === 'string') {
        userId = clientInfo.userId;
      }
    } catch {
      throw new ServiceUnavailableException('学校 WebVPN 会话格式已变化');
    }
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(userId)) {
      throw new ServiceUnavailableException('学校 WebVPN 用户会话无效');
    }

    const paths = [
      '/enlink/api/client/policy/v2/client/hasQuickAccessPolicy',
      `/enlink/api/client/user/findByUserId/${encodeURIComponent(userId)}`,
      '/enlink/api/client/clusters/etcd/getShowCsServiceState',
      '/enlink/api/client/service/getTerminalProtocol',
    ];
    for (const path of paths) {
      const result = await this.fetchFollowing(
        client,
        new URL(path, this.gateway),
        { headers: this.portalApiHeaders() },
      );
      if (!result.response.ok) {
        throw new UnprocessableEntityException('学校 WebVPN 登录失败');
      }
    }
    return userId;
  }

  private async resolveSeatProxy(
    client: CookieFetch,
    userId: string,
  ): Promise<SeatProxy> {
    const result = await this.fetchFollowing(
      client,
      new URL(
        '/enlink/api/client/service/group/treeWithService/',
        this.gateway,
      ),
      {
        method: 'POST',
        headers: this.portalApiHeaders(),
        body: JSON.stringify({ nameLike: '', serviceNameLike: '', userId }),
      },
    );
    if (!result.response.ok) {
      throw new ServiceUnavailableException('学校 WebVPN 应用列表不可用');
    }
    const payload: unknown = await result.response.json();
    const service = findSeatService(payload, this.seatAppName);
    if (!service || service.canVisit === false) {
      throw new UnprocessableEntityException('当前学校账号无座位系统访问权限');
    }

    const proxyUrl = new URL(service.urlPlus);
    if (
      proxyUrl.origin !== this.gateway.origin ||
      !proxyUrl.pathname.startsWith('/http/webvpn')
    ) {
      throw new ServiceUnavailableException('学校 WebVPN 返回了无效的座位入口');
    }
    if (typeof service.server !== 'string') {
      throw new ServiceUnavailableException('学校 WebVPN 座位入口缺少目标地址');
    }
    const serverUrl = new URL(service.server);
    if (!['http:', 'https:'].includes(serverUrl.protocol)) {
      throw new ServiceUnavailableException('学校 WebVPN 座位目标地址无效');
    }
    return {
      baseUrl: proxyUrl.toString().replace(/\/$/, ''),
      serverUrl: serverUrl.toString().replace(/\/$/, ''),
    };
  }

  private async startSeatCas(
    client: CookieFetch,
    seatProxy: SeatProxy,
    username: string,
    password: string,
  ): Promise<FollowResult> {
    const redirectUrl = `${seatProxy.serverUrl}${this.seatAppPath}#/`;
    const ssoUrl = proxyUrl(seatProxy.baseUrl, '/remote/static/sso/login');
    ssoUrl.searchParams.set('redirectUrl', redirectUrl);
    const result = await this.fetchFollowing(client, ssoUrl);
    if (result.fragmentToken) return result;
    return this.submitCasForm(client, result, username, password);
  }

  private async submitCasForm(
    client: CookieFetch,
    page: FollowResult,
    username: string,
    password: string,
  ): Promise<FollowResult> {
    const html = await page.response.text();
    const $ = load(html);
    const form = $('form')
      .filter(
        (_, element) => $(element).find('input[name="username"]').length > 0,
      )
      .first();
    if (!form.length) {
      if (page.url.origin === this.gateway.origin) return page;
      throw new UnprocessableEntityException('学校统一认证页面格式已变化');
    }

    const fields = new URLSearchParams();
    form.find('input[name]').each((_, element) => {
      const name = $(element).attr('name');
      if (name) fields.set(name, $(element).attr('value') || '');
    });
    fields.set('username', username);
    fields.set('password', Buffer.from(password, 'utf8').toString('base64'));
    fields.set('_eventId', fields.get('_eventId') || 'submit');

    const action = new URL(
      form.attr('action') || page.url.toString(),
      page.url,
    );
    const submitted = await this.fetchFollowing(client, action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: page.url.toString(),
      },
      body: fields,
    });
    if (
      submitted.url.hostname === 'sso.cczu.edu.cn' &&
      !submitted.fragmentToken
    ) {
      throw new UnprocessableEntityException('学校统一认证账号或密码错误');
    }
    return submitted;
  }

  private async loadSigningSecret(
    client: CookieFetch,
    proxyBase: string,
  ): Promise<string> {
    const configUrl = proxyUrl(
      proxyBase,
      `${this.seatAppPath}static/baseUrl.js`,
    );
    const result = await this.fetchFollowing(client, configUrl);
    const script = await result.response.text();
    const encrypted = script.match(/NUMCODE:\s*["']([^"']+)["']/)?.[1];
    if (!encrypted) {
      throw new ServiceUnavailableException('座位系统签名配置不可用');
    }

    try {
      const decipher = createDecipheriv(
        'aes-128-cbc',
        Buffer.from('server_date_time'),
        Buffer.from('client_date_time'),
      );
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('座位系统签名配置解析失败');
    }
  }

  private async exchangeSsoToken(
    client: CookieFetch,
    seatProxy: SeatProxy,
    ssoToken: string,
    signingSecret: string,
  ): Promise<string> {
    const requestId = randomUUID();
    const requestDate = String(Date.now());
    const requestKey = createHmac('sha256', signingSecret)
      .update(`seat::${requestId}::${requestDate}::POST`)
      .digest('hex');
    const url = proxyApiUrl(seatProxy.baseUrl, '/rest/ssoAuth', ssoToken);

    const result = await this.fetchFollowing(client, url, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Authorization: 'null',
        'Content-Type': 'application/json',
        loginType: 'PC',
        Origin: new URL(seatProxy.serverUrl).origin,
        Referer: `${seatProxy.serverUrl}${this.seatAppPath}`,
        'X-hmac-request-key': requestKey,
        'X-request-date': requestDate,
        'X-request-id': requestId,
      },
      body: JSON.stringify({ token: ssoToken }),
    });
    const payload = (await result.response.json()) as SeatAuthResponse;
    const data = isRecord(payload.data) ? payload.data : null;
    const token = data?.token;
    if (
      !result.response.ok ||
      payload.status !== 'success' ||
      String(payload.code) !== '0' ||
      typeof token !== 'string' ||
      !token
    ) {
      throw new UnprocessableEntityException(
        typeof payload.message === 'string' && payload.message
          ? payload.message
          : '座位系统统一认证失败',
      );
    }
    return token;
  }

  private async signedSeatRequest(
    token: string,
    method: 'GET' | 'POST',
    path: string,
    body?: URLSearchParams | FormData,
    timeoutMs?: number,
  ): Promise<SeatResponse> {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return {
        httpStatus: 401,
        payload: null,
        message: 'WebVPN 会话需要刷新',
        code: '12',
        success: false,
      };
    }

    const requestId = randomUUID();
    const requestDate = String(Date.now());
    const requestKey = createHmac('sha256', session.signingSecret)
      .update(`seat::${requestId}::${requestDate}::${method}`)
      .digest('hex');
    const url = proxyApiUrl(session.proxyBase, path, token);
    const headers: HeadersInit = {
      Accept: 'application/json, text/plain, */*',
      Authorization: token,
      loginType: 'PC',
      Referer: session.targetReferer,
      'X-hmac-request-key': requestKey,
      'X-request-date': requestDate,
      'X-request-id': requestId,
    };
    if (body) {
      (headers as Record<string, string>).Origin = session.targetOrigin;
      if (body instanceof URLSearchParams) {
        (headers as Record<string, string>)['Content-Type'] =
          'application/x-www-form-urlencoded;charset=UTF-8';
      }
    }

    try {
      const result = await this.fetchFollowing(session.client, url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs ?? this.timeoutMs),
      });
      const raw = await result.response.text();
      let payload: Record<string, unknown> | null = null;
      try {
        const value: unknown = JSON.parse(raw);
        payload = isRecord(value) ? value : null;
      } catch {
        payload = null;
      }
      const message =
        typeof payload?.message === 'string'
          ? payload.message
          : raw.slice(0, 240);
      const code = payload?.code === undefined ? '' : String(payload.code);
      const success =
        result.response.status === 200 &&
        payload?.status === 'success' &&
        code === '0';
      if (code === '12') this.sessions.delete(token);
      return {
        httpStatus: result.response.status,
        payload,
        message,
        code,
        success,
      };
    } catch {
      return {
        httpStatus: 0,
        payload: null,
        message: '学校 WebVPN 请求暂时不可用',
        code: '',
        success: false,
      };
    }
  }

  private pruneSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(token);
    }
  }

  private async fetchFollowing(
    client: CookieFetch,
    initialUrl: URL,
    initialInit: RequestInit = {},
  ): Promise<FollowResult> {
    let url = new URL(initialUrl);
    let method = initialInit.method || 'GET';
    let body = initialInit.body;
    let fragmentToken = extractFragmentToken(url);
    let headers = new Headers(initialInit.headers);

    for (let redirectCount = 0; redirectCount <= 20; redirectCount += 1) {
      this.assertAllowedUrl(url);
      const response = await client(url, {
        ...initialInit,
        method,
        body,
        headers: withDefaultHeaders(headers, this.userAgent),
        redirect: 'manual',
        signal: initialInit.signal ?? AbortSignal.timeout(this.timeoutMs),
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        return { response, url, fragmentToken };
      }

      const location = response.headers.get('location');
      if (!location) return { response, url, fragmentToken };
      const nextUrl = new URL(location, url);
      fragmentToken = extractFragmentToken(nextUrl) || fragmentToken;
      if (
        response.status === 303 ||
        ((response.status === 301 || response.status === 302) &&
          method === 'POST')
      ) {
        method = 'GET';
        body = undefined;
        headers = new Headers();
      }
      url = nextUrl;
    }
    throw new ServiceUnavailableException('学校登录重定向次数过多');
  }

  private assertAllowedUrl(url: URL): void {
    const allowedHosts = new Set([this.gateway.hostname, 'sso.cczu.edu.cn']);
    if (
      !allowedHosts.has(url.hostname) ||
      !['http:', 'https:'].includes(url.protocol)
    ) {
      throw new ServiceUnavailableException('学校登录返回了不受信任的地址');
    }
  }

  private portalApiHeaders(): HeadersInit {
    return {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8',
      Referer: new URL('/enlink/', this.gateway).toString(),
    };
  }
}

function withDefaultHeaders(headers: Headers, userAgent: string): Headers {
  const result = new Headers(headers);
  if (!result.has('Accept')) result.set('Accept', '*/*');
  if (!result.has('Accept-Language'))
    result.set('Accept-Language', 'zh-CN,zh;q=0.9');
  if (!result.has('User-Agent')) result.set('User-Agent', userAgent);
  return result;
}

function extractFragmentToken(url: URL): string | null {
  const query = url.hash.replace(/^#\/?\??/, '');
  return query ? new URLSearchParams(query).get('token') : null;
}

function findSeatService(
  value: unknown,
  targetName: string,
): SeatServiceConfig | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findSeatService(item, targetName);
      if (match) return match;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.name === targetName && typeof value.urlPlus === 'string') {
    return value as unknown as SeatServiceConfig;
  }
  for (const item of Object.values(value)) {
    const match = findSeatService(item, targetName);
    if (match) return match;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAppPath(value: string): string {
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

function proxyUrl(proxyBase: string, path: string): URL {
  return new URL(`${proxyBase}${path.startsWith('/') ? path : `/${path}`}`);
}

function proxyApiUrl(proxyBase: string, path: string, token: string): URL {
  const url = proxyUrl(proxyBase, path);
  url.searchParams.set('token', token);
  url.searchParams.set('enlink-vpn', '');
  return url;
}

function extractProxyBase(pageUrl: URL, gateway: URL, appPath: string): string {
  const normalizedPath = normalizeAppPath(appPath);
  if (
    pageUrl.origin !== gateway.origin ||
    !pageUrl.pathname.startsWith('/http/webvpn') ||
    !pageUrl.pathname.endsWith(normalizedPath)
  ) {
    throw new ServiceUnavailableException('学校 WebVPN 未返回自习室代理入口');
  }

  return new URL(pageUrl.pathname.slice(0, -normalizedPath.length), gateway)
    .toString()
    .replace(/\/$/, '');
}

function proxyTargetsOrigin(pageUrl: URL, target: URL): boolean {
  const host = target.hostname.replace(/\./g, '-');
  return pageUrl.pathname.toLowerCase().includes(host.toLowerCase());
}

function extractGatewayLoginKey(html: string): string | null {
  const match = html.match(/var\s+indexConfig\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return null;

  try {
    const config: unknown = JSON.parse(match[1]);
    if (
      isRecord(config) &&
      typeof config.key === 'string' &&
      Buffer.byteLength(config.key, 'utf8') === 16
    ) {
      return config.key;
    }
  } catch {
    return null;
  }

  return null;
}

async function readGatewayLoginMessage(
  response: Response,
): Promise<string | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return null;

  const html = await response.text();
  const match = html.match(/var\s+errMsg\s*=\s*(.*?);/);
  if (!match) return null;

  try {
    const value: unknown = JSON.parse(match[1]);
    return typeof value === 'string' && value ? value : null;
  } catch {
    return null;
  }
}

function numberSetting(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
