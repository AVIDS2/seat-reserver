import { describe, expect, it } from '@jest/globals';
import { isRetryableConnectionError } from './platform-service-connections.service';

describe('platform service connection recovery classification', () => {
  it('should keep school gateway infrastructure failures retryable', () => {
    expect(
      isRetryableConnectionError(new Error('学校 WebVPN Mysql连接异常')),
    ).toBe(true);
    expect(
      isRetryableConnectionError(new Error('学校 WebVPN 请求暂时不可用')),
    ).toBe(true);
  });

  it('should not retry explicit credential failures', () => {
    expect(
      isRetryableConnectionError(new Error('学校 WebVPN 账号或密码错误')),
    ).toBe(false);
    expect(
      isRetryableConnectionError(new Error('学校统一认证账号或密码错误')),
    ).toBe(false);
  });
});
