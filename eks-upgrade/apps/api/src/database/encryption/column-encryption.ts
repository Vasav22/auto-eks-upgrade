import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext The text to encrypt
 * @param key Base64-encoded 32-byte key
 * @returns Colon-separated string: iv:authTag:ciphertext (all base64-encoded)
 */
export function encrypt(plaintext: string, key: string): string {
  if (!plaintext) {
    return '';
  }

  if (!key) {
    throw new Error('Encryption key is required');
  }

  const keyBuffer = Buffer.from(key, 'base64');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes`);
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string using AES-256-GCM
 * @param ciphertext Colon-separated string: iv:authTag:ciphertext
 * @param key Base64-encoded 32-byte key
 * @returns The decrypted plaintext
 */
export function decrypt(ciphertext: string, key: string): string {
  if (!ciphertext) {
    return '';
  }

  if (!key) {
    throw new Error('Decryption key is required');
  }

  const keyBuffer = Buffer.from(key, 'base64');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Decryption key must be ${KEY_LENGTH} bytes`);
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format. Expected iv:authTag:ciphertext');
  }

  const [ivBase64, authTagBase64, encryptedBase64] = parts;

  try {
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error: unknown) {
    throw new Error(
      `Decryption failed: ${(error as Error).message}. This may indicate wrong key or corrupted ciphertext.`,
    );
  }
}

/**
 * Generates a new random encryption key
 * @returns Base64-encoded 32-byte key
 */
export function generateKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}
