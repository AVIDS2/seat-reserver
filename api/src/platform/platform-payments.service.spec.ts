import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { PlatformPaymentsService } from './platform-payments.service';

describe('PlatformPaymentsService', () => {
  it('should reject checkout creation when Stripe is not configured', async () => {
    const previousSecret = process.env.PLATFORM_STRIPE_SECRET_KEY;
    const previousPrice = process.env.PLATFORM_STRIPE_PRICE_ID;
    delete process.env.PLATFORM_STRIPE_SECRET_KEY;
    delete process.env.PLATFORM_STRIPE_PRICE_ID;

    const service = new PlatformPaymentsService(
      {} as never,
      {
        getEntitlement: () => Promise.resolve({ isPro: false }),
      } as never,
    );

    await expect(service.createProCheckout(1)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    restoreEnv('PLATFORM_STRIPE_SECRET_KEY', previousSecret);
    restoreEnv('PLATFORM_STRIPE_PRICE_ID', previousPrice);
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
