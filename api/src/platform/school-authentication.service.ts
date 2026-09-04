import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { SeatClientService } from './seat-client.service';
import { WebVpnSeatClientService } from './webvpn-seat-client.service';
import type { SeatCandidate, SeatResponse } from './seat-client.service';
import type { SeatServiceType } from './entities/school-service-connection.entity';

export type SchoolAuthMode = 'direct' | 'webvpn';

type SchoolAuthenticationResult = {
  token: string;
  mode: SchoolAuthMode;
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
  ) {}

  async authenticate(
    username: string,
    password: string,
    mode?: SchoolAuthMode,
    serviceType: SeatServiceType = 'study_room',
  ): Promise<SchoolAuthenticationResult> {
    const key = `${serviceType}:${mode || 'auto'}:${username}`;
    const current = this.authenticationFlights.get(key);
    if (current) return current;

    const flight = this.authenticateOnce(username, password, mode, serviceType);
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
  ): Promise<SchoolAuthenticationResult> {
    if (serviceType === 'library') {
      const result = await this.webVpnSeatClient.authenticate(
        username,
        password,
        serviceType,
      );
      return { token: result.token, mode: 'webvpn' };
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
      return { token: result.token, mode };
    }

    try {
      const result = await this.seatClient.authenticate(username, password);
      return { token: result.token, mode: 'direct' };
    } catch (error: unknown) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      if (isCredentialError(error)) throw error;
      const result = await this.webVpnSeatClient.authenticate(
        username,
        password,
        serviceType,
      );
      return { token: result.token, mode: 'webvpn' };
    }
  }

  async verifyToken(
    token: string,
    mode: SchoolAuthMode,
    serviceType: SeatServiceType = 'study_room',
  ): Promise<SeatResponse> {
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
  ): Promise<SeatResponse> {
    return mode === 'webvpn' || serviceType === 'library'
      ? this.webVpnSeatClient.book(token, date, candidate, timeoutMs)
      : this.seatClient.book(token, date, candidate, timeoutMs);
  }

  async get(
    token: string,
    mode: SchoolAuthMode,
    path: string,
    serviceType: SeatServiceType = 'study_room',
  ): Promise<SeatResponse> {
    return mode === 'webvpn' || serviceType === 'library'
      ? this.webVpnSeatClient.get(token, path)
      : this.seatClient.get(token, path);
  }
}

function isCredentialError(error: UnprocessableEntityException): boolean {
  const response = error.getResponse();
  const message =
    typeof response === 'string'
      ? response
      : response && typeof response === 'object' && 'message' in response
        ? String(response.message)
        : error.message;

  return /(用户名|账号).*(密码|不正确|错误)|(密码|凭据).*(不正确|错误)/i.test(
    message,
  );
}
