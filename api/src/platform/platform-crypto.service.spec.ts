import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { PlatformCryptoService } from './platform-crypto.service';

describe('PlatformCryptoService', () => {
  const previousKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-only-credential-key';
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    else process.env.CREDENTIAL_ENCRYPTION_KEY = previousKey;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  it('should round-trip encrypted values without storing plaintext', () => {
    const service = new PlatformCryptoService();
    const plaintext = 'school-password-and-token';
    const encrypted = service.encrypt(plaintext);

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it('should reject tampered ciphertext', () => {
    const service = new PlatformCryptoService();
    const encrypted = service.encrypt('secret');
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('a') ? 'b' : 'a'}`;

    expect(() => service.decrypt(tampered)).toThrow();
  });
});
