import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request as ExpressRequest } from 'express';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { PlatformPaymentsService } from './platform-payments.service';

type RawBodyRequest = ExpressRequest & { rawBody?: Buffer };

@ApiTags('Platform Payments')
@Controller({ path: 'platform/payments', version: '1' })
export class PlatformPaymentsController {
  constructor(private readonly payments: PlatformPaymentsService) {}

  @Post('pro/checkout')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async checkout(
    @Request() request: RequestWithUser<JwtPayloadType>,
  ): Promise<{ url: string; sessionId: string }> {
    return this.payments.createProCheckout(Number(request.user.id));
  }

  @Post('stripe/webhook')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() request: RawBodyRequest,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true; activated: boolean }> {
    if (!signature || !request.rawBody) {
      throw new BadRequestException(
        'Stripe webhook body or signature is missing',
      );
    }
    return this.payments.handleStripeWebhook(request.rawBody, signature);
  }
}
