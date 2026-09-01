import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class PlatformCryptoService {
  constructor() {
    const configured = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (
      process.env.NODE_ENV === 'production' &&
      (!configured || configured.startsWith('replace-with-'))
    ) {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY must be configured with a strong production secret',
      );
    }
  }

  private getKey(): Buffer {
    const configured = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!configured) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY is required');
    }

    return createHash('sha256').update(configured).digest();
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(value: string): string {
    const [version, ivValue, authTagValue, encryptedValue] = value.split('.');
    if (version !== 'v1' || !ivValue || !authTagValue || !encryptedValue) {
      throw new Error('Unsupported encrypted value');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getKey(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  digest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
