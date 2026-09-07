import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { PlatformMembershipService } from './platform-membership.service';

@Injectable()
export class PlatformPaymentsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly membership: PlatformMembershipService,
  ) {}

  async createProCheckout(
    userId: number,
  ): Promise<{ url: string; sessionId: string }> {
    const entitlement = await this.membership.getEntitlement(userId);
    if (entitlement.isPro) {
      throw new UnprocessableEntityException('当前账号已经拥有 Pro 权益');
    }

    const stripe = this.getStripe();
    const priceId = process.env.PLATFORM_STRIPE_PRICE_ID?.trim();
    const webhookSecret = process.env.PLATFORM_STRIPE_WEBHOOK_SECRET?.trim();
    if (!priceId || !webhookSecret) {
      throw new ServiceUnavailableException('在线支付尚未配置，请提交开通申请');
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnprocessableEntityException('用户不存在');

    const baseUrl = (
      process.env.PLATFORM_PUBLIC_URL ||
      process.env.FRONTEND_DOMAIN ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/store?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/store?checkout=cancelled`,
      client_reference_id: String(userId),
      customer_email: user.email || undefined,
      metadata: { userId: String(userId), product: 'pro_permanent' },
    });

    if (!session.url) {
      throw new ServiceUnavailableException('支付页面创建失败，请稍后重试');
    }
    return { url: session.url, sessionId: session.id };
  }

  async handleStripeWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<{ received: true; activated: boolean }> {
    const webhookSecret = process.env.PLATFORM_STRIPE_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook 尚未配置');
    }

    let event: Stripe.Event;
    try {
      event = this.getStripe().webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch {
      throw new UnprocessableEntityException('Stripe webhook 签名无效');
    }

    if (event.type !== 'checkout.session.completed') {
      return { received: true, activated: false };
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') {
      return { received: true, activated: false };
    }
    const expectedPriceId = process.env.PLATFORM_STRIPE_PRICE_ID?.trim();
    if (
      !expectedPriceId ||
      !(await this.matchesConfiguredPrice(session, expectedPriceId))
    ) {
      throw new UnprocessableEntityException('Stripe 订单商品或金额不匹配');
    }
    const userId = Number(
      session.metadata?.userId || session.client_reference_id || 0,
    );
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnprocessableEntityException('Stripe 订单缺少平台用户标识');
    }

    await this.membership.grantProFromPayment(userId, session.id);
    return { received: true, activated: true };
  }

  private async matchesConfiguredPrice(
    session: Stripe.Checkout.Session,
    expectedPriceId: string,
  ): Promise<boolean> {
    if (
      session.amount_total !== 2000 ||
      session.currency?.toLowerCase() !== 'cny'
    ) {
      return false;
    }
    const lineItems = await this.getStripe().checkout.sessions.listLineItems(
      session.id,
      { limit: 10 },
    );
    return lineItems.data.some(
      (item) => item.price?.id === expectedPriceId && item.quantity === 1,
    );
  }

  private getStripe(): Stripe {
    const secretKey = process.env.PLATFORM_STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new ServiceUnavailableException('在线支付尚未配置，请提交开通申请');
    }
    return new Stripe(secretKey, { apiVersion: '2025-04-30.basil' });
  }
}
