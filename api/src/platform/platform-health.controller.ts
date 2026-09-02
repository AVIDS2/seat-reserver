import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { PlatformRedisService } from './platform-redis.service';

@ApiTags('Platform Health')
@Controller({ path: 'platform/health', version: '1' })
export class PlatformHealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: PlatformRedisService,
  ) {}

  @Get()
  async health() {
    const redis = await this.redis.ping();
    return {
      status: redis && this.dataSource.isInitialized ? 'ok' : 'degraded',
      database: this.dataSource.isInitialized ? 'ok' : 'down',
      redis: redis ? 'ok' : 'down',
    };
  }
}
