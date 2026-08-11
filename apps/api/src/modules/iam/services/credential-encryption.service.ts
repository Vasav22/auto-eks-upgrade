/**
 * Field-level AES-256-GCM encryption for sensitive credential fields (WO-099).
 *
 * The encryption key is derived from the CREDENTIAL_ENCRYPTION_KEY env var
 * (32 bytes hex-encoded, i.e. 64 hex chars). In production this should be
 * sourced from AWS Secrets Manager or KMS Data Key Caching.
 *
 * Format stored in DB: `v1:<base64-iv>:<base64-ciphertext>:<base64-authTag>`
 */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SALT = 'eks-upgrade-cred-salt';

@Injectable()
export class CredentialEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(CredentialEncryptionService.name);
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const rawKey = this.config.get<string>('CREDENTIAL_ENCRYPTION_KEY');
    if (!rawKey) {
      this.logger.warn(
        'CREDENTIAL_ENCRYPTION_KEY is not set. Using ephemeral key — credentials will NOT survive restart.',
      );
      this.key = randomBytes(32);
      return;
    }
    if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
      this.key = Buffer.from(rawKey, 'hex');
    } else {
      // Derive a 256-bit key from any passphrase using scrypt
      this.key = scryptSync(rawKey, SALT, 32) as Buffer;
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64'), ciphertext.toString('base64'), tag.toString('base64')].join(':');
  }

  decrypt(stored: string): string {
    const parts = stored.split(':');
    if (parts.length !== 4 || parts[0] !== VERSION) {
      // Treat un-encrypted legacy values as plaintext
      return stored;
    }
    const [, ivB64, ctB64, tagB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(ctB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag.subarray(0, TAG_BYTES));
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(`${VERSION}:`);
  }
}
