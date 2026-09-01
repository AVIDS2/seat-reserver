import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

@Injectable()
export class PlatformRedisService implements OnModuleDestroy {
  private readonly client = new Redis(
    process.env.QUEUE_REDIS_URL || 'redis://redis:6379/1',
    {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    },
  );

  async tryLock(key: string, ttlSeconds: number): Promise<string | null> {
    const value = randomUUID();
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? value : null;
  }

  async unlock(key: string, value: string): Promise<void> {
    await this.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      value,
    );
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
