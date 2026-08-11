import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EncryptedData {
  ciphertext: string;
  nonce: string;
  tag: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const keyBase64 = process.env['ENCRYPTION_KEY'];
    if (!keyBase64) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    this.key = Buffer.from(keyBase64, 'base64');
    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits)');
    }
  }

  encrypt(plaintext: string): EncryptedData {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, nonce);

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    const tag = cipher.getAuthTag();

    return {
      ciphertext,
      nonce: nonce.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  decrypt(data: EncryptedData): string {
    const nonce = Buffer.from(data.nonce, 'base64');
    const tag = Buffer.from(data.tag, 'base64');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, nonce);

    decipher.setAuthTag(tag);

    let plaintext = decipher.update(data.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }
}
