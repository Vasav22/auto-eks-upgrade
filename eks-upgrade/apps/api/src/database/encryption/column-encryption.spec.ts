import { encrypt, decrypt, generateKey } from './column-encryption';

describe('Column Encryption', () => {
  let testKey: string;

  beforeAll(() => {
    testKey = generateKey();
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string successfully', () => {
      const plaintext = 'arn:aws:iam::123456789012:role/EKSUpgradeRole';

      const ciphertext = encrypt(plaintext, testKey);
      const decrypted = decrypt(ciphertext, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'sensitive-data';

      const ciphertext1 = encrypt(plaintext, testKey);
      const ciphertext2 = encrypt(plaintext, testKey);

      expect(ciphertext1).not.toBe(ciphertext2);

      expect(decrypt(ciphertext1, testKey)).toBe(plaintext);
      expect(decrypt(ciphertext2, testKey)).toBe(plaintext);
    });

    it('should throw error when decrypting with wrong key', () => {
      const plaintext = 'secret-value';
      const wrongKey = generateKey();

      const ciphertext = encrypt(plaintext, testKey);

      expect(() => decrypt(ciphertext, wrongKey)).toThrow('Decryption failed');
    });

    it('should handle empty string', () => {
      const result = encrypt('', testKey);
      expect(result).toBe('');

      const decrypted = decrypt('', testKey);
      expect(decrypted).toBe('');
    });

    it('should throw error when key is missing', () => {
      expect(() => encrypt('data', '')).toThrow('Encryption key is required');
      expect(() => decrypt('data', '')).toThrow('Decryption key is required');
    });

    it('should throw error when key is wrong length', () => {
      const shortKey = Buffer.from('short').toString('base64');

      expect(() => encrypt('data', shortKey)).toThrow(
        'Encryption key must be 32 bytes',
      );
    });

    it('should throw error for invalid ciphertext format', () => {
      expect(() => decrypt('invalid-format', testKey)).toThrow(
        'Invalid ciphertext format',
      );
    });

    it('should encrypt/decrypt long strings', () => {
      const longPlaintext = 'A'.repeat(1000);

      const ciphertext = encrypt(longPlaintext, testKey);
      const decrypted = decrypt(ciphertext, testKey);

      expect(decrypted).toBe(longPlaintext);
    });

    it('should encrypt/decrypt unicode characters', () => {
      const unicodePlaintext = '测试数据 🔐 Тест данных';

      const ciphertext = encrypt(unicodePlaintext, testKey);
      const decrypted = decrypt(ciphertext, testKey);

      expect(decrypted).toBe(unicodePlaintext);
    });
  });

  describe('generateKey', () => {
    it('should generate a valid base64 key', () => {
      const key = generateKey();

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');

      const keyBuffer = Buffer.from(key, 'base64');
      expect(keyBuffer.length).toBe(32);
    });

    it('should generate different keys each time', () => {
      const key1 = generateKey();
      const key2 = generateKey();

      expect(key1).not.toBe(key2);
    });
  });
});
