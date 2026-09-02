import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { SeatClientService } from './seat-client.service';
import { WebVpnSeatClientService } from './webvpn-seat-client.service';
import type { SeatCandidate, SeatResponse } from './seat-client.service';

export type SchoolAuthMode = 'direct' | 'webvpn';

@Injectable()
export class SchoolAuthenticationService {
  constructor(
    private readonly seatClient: SeatClientService,
    private readonly webVpnSeatClient: WebVpnSeatClientService,
  ) {}

  async authenticate(
    username: string,
    password: string,
    mode?: SchoolAuthMode,
  ): Promise<{ token: string; mode: SchoolAuthMode }> {
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
