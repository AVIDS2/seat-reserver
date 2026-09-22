import {
  Injectable,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SeatClientService } from './seat-client.service';
import {
  type BookingCaptchaChallenge,
  type BookingCaptchaPoint,
  WebVpnSeatClientService,
  type WebVpnSessionState,
} from './webvpn-seat-client.service';
import { NjtechSeatClientService } from './njtech-seat-client.service';
import type { SchoolCode } from './school-catalog';
import type { SeatCandidate, SeatResponse } from './seat-client.service';
import type { SeatServiceType } from './entities/school-service-connection.entity';

export type SchoolAuthMode = 'direct' | 'webvpn';

export type SchoolAuthenticationResult = {
  token: string;
  mode: SchoolAuthMode;
  webVpnSession?: WebVpnSessionState;
};

@Injectable()
export class SchoolAuthenticationService {
  private readonly authenticationFlights = new Map<
    string,
    Promise<SchoolAuthenticationResult>
  >();

  constructor(
    private readonly seatClient: SeatClientService,
    private readonly webVpnSeatClient: WebVpnSeatClientService,
    @Optional() private readonly njtechSeatClient?: NjtechSeatClientService,
  ) {}

  async authenticate(
    username: string,
    password: string,
    mode?: SchoolAuthMode,
    serviceType: SeatServiceType = 'study_room',
    schoolCode: SchoolCode = 'cczu',
  ): Promise<SchoolAuthenticationResult> {
    const key = `${schoolCode}:${serviceType}:${mode || 'auto'}:${username}`;
    const current = this.authenticationFlights.get(key);
    if (current) return current;

    const flight = this.authenticateOnce(
      username,
      password,
      mode,
      serviceType,
      schoolCode,
    );
    this.authenticationFlights.set(key, flight);
    try {
      return await flight;
    } finally {
      if (this.authenticationFlights.get(key) === flight) {
        this.authenticationFlights.delete(key);
      }
    }
  }

  private async authenticateOnce(
    username: string,
    password: string,
    mode?: SchoolAuthMode,
    serviceType: SeatServiceType = 'study_room',
    schoolCode: SchoolCode = 'cczu',
  ): Promise<SchoolAuthenticationResult> {
    if (schoolCode === 'njtech') {
      if (!this.njtechSeatClient)
        throw new UnprocessableEntityException('南京工业大学适配器未启用');
      const result = await this.njtechSeatClient.authenticate(
        username,
        password,
      );
      return {
        token: result.token,
        mode: 'webvpn',
        webVpnSession: result.session,
      };
    }
    if (serviceType === 'library') {
      const result = await this.webVpnSeatClient.authenticate(
        username,
        password,
        serviceType,
      );
      return {
        token: result.token,
        mode: 'webvpn',
        webVpnSession: result.session,
      };
    }
    if (mode === 'direct') {
      const result = await this.seatClient.authenticate(username, password);
      return { token: result.token, mode };
    }
    if (mode === 'webvpn') {
      const result = await this.webVpnSeatClient.authenticate(
        username,
        password,
        serviceType,
      );
      return {
        token: result.token,
        mode,
        webVpnSession: result.session,
      };
    }

    try {
      const result = await this.seatClient.authenticate(username, password);
      return { token: result.token, mode: 'direct' };
    } catch (error: unknown) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      const result = await this.webVpnSeatClient.authenticate(
        username,
        password,
        serviceType,
      );
      return {
        token: result.token,
        mode: 'webvpn',
        webVpnSession: result.session,
      };
    }
  }

  async verifyToken(
    token: string,
    mode: SchoolAuthMode,
    serviceType: SeatServiceType = 'study_room',
    schoolCode: SchoolCode = 'cczu',
  ): Promise<SeatResponse> {
    if (schoolCode === 'njtech') {
      if (!this.njtechSeatClient)
        throw new UnprocessableEntityException('南京工业大学适配器未启用');
      return this.njtechSeatClient.verifyToken(token);
    }
    return mode === 'webvpn' || serviceType === 'library'
      ? this.webVpnSeatClient.verifyToken(token)
      : this.seatClient.verifyToken(token);
  }

  async book(
    token: string,
    mode: SchoolAuthMode,
    date: string,
    candidate: SeatCandidate,
    timeoutMs: number,
    serviceType: SeatServiceType = 'study_room',
    schoolCode: SchoolCode = 'cczu',
  ): Promise<SeatResponse> {
    if (schoolCode === 'njtech') {
      if (!this.njtechSeatClient)
        throw new UnprocessableEntityException('南京工业大学适配器未启用');
      return this.njtechSeatClient.book(token, date, candidate);
    }
    return mode === 'webvpn' || serviceType === 'library'
      ? this.webVpnSeatClient.book(token, date, candidate, timeoutMs)
      : this.seatClient.book(token, date, candidate, timeoutMs);
  }

  async get(
    token: string,
    mode: SchoolAuthMode,
    path: string,
    serviceType: SeatServiceType = 'study_room',
    schoolCode: SchoolCode = 'cczu',
  ): Promise<SeatResponse> {
    if (schoolCode === 'njtech') {
      if (!this.njtechSeatClient)
        throw new UnprocessableEntityException('南京工业大学适配器未启用');
      return this.njtechSeatClient.get(token, path);
    }
    return mode === 'webvpn' || serviceType === 'library'
      ? this.webVpnSeatClient.get(token, path)
      : this.seatClient.get(token, path);
  }

  createBookingCaptcha(
    token: string,
    schoolCode: SchoolCode = 'cczu',
  ): Promise<BookingCaptchaChallenge> {
    if (schoolCode === 'njtech') {
      throw new UnprocessableEntityException(
        '南京工业大学预约验证码使用登录认证，不需要座位点选验证',
      );
    }
    return this.webVpnSeatClient.createBookingCaptcha(token);
  }

  verifyBookingCaptcha(
    token: string,
    challengeToken: string,
    points: BookingCaptchaPoint[],
    schoolCode: SchoolCode = 'cczu',
  ): Promise<SeatResponse> {
    if (schoolCode === 'njtech') {
      throw new UnprocessableEntityException(
        '南京工业大学预约验证码使用登录认证，不需要座位点选验证',
      );
    }
    return this.webVpnSeatClient.verifyBookingCaptcha(
      token,
      challengeToken,
      points,
    );
  }

  restoreWebVpnSession(
    token: string,
    state: WebVpnSessionState,
    schoolCode: SchoolCode = 'cczu',
  ): boolean {
    if (schoolCode === 'njtech') {
      if (!this.njtechSeatClient) return false;
      return this.njtechSeatClient.restoreSession(token, state);
    }
    return this.webVpnSeatClient.restoreSession(token, state);
  }

  getWebVpnSession(
    token: string,
    schoolCode: SchoolCode = 'cczu',
  ): WebVpnSessionState | null {
    if (schoolCode === 'njtech') {
      return this.njtechSeatClient?.getSessionState(token) || null;
    }
    return this.webVpnSeatClient.getSessionState(token);
  }
}
