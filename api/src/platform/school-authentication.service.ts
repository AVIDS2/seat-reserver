import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { SeatClientService } from './seat-client.service';
import { WebVpnSeatClientService } from './webvpn-seat-client.service';
import type { SeatCandidate, SeatResponse } from './seat-client.service';

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
  ): Promise<SchoolAuthenticationResult> {
    const key = `${mode || 'auto'}:${username}`;
    const current = this.authenticationFlights.get(key);
    if (current) return current;

    const flight = this.authenticateOnce(username, password, mode);
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
  ): Promise<SchoolAuthenticationResult> {
    if (mode === 'direct') {
      const result = await this.seatClient.authenticate(username, password);
      return { token: result.token, mode };
    }
    if (mode === 'webvpn') {
      const result = await this.webVpnSeatClient.authenticate(
        username,
        password,
      );
      return { token: result.token, mode };
    }

    try {
      const result = await this.seatClient.authenticate(username, password);
      return { token: result.token, mode: 'direct' };
    } catch (error: unknown) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      const result = await this.webVpnSeatClient.authenticate(
        username,
        password,
      );
      return { token: result.token, mode: 'webvpn' };
    }
  }

  async verifyToken(
    token: string,
    mode: SchoolAuthMode,
  ): Promise<SeatResponse> {
    return mode === 'webvpn'
      ? this.webVpnSeatClient.verifyToken(token)
      : this.seatClient.verifyToken(token);
  }

  async book(
    token: string,
    mode: SchoolAuthMode,
    date: string,
    candidate: SeatCandidate,
    timeoutMs: number,
  ): Promise<SeatResponse> {
    return mode === 'webvpn'
      ? this.webVpnSeatClient.book(token, date, candidate, timeoutMs)
      : this.seatClient.book(token, date, candidate, timeoutMs);
  }
}
