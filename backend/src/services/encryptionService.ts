/**
 * Encryption Service for sensitive data storage
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';
import { logger } from '../middleware/logger';

// Encryption key from environment (32 bytes for AES-256)
// In production, use: openssl rand -base64 32
let ENCRYPTION_KEY: Buffer | null = null;

// Derive a 32-byte key from the environment variable (lazy-loaded on first use)
function getEncryptionKey(): Buffer {
  // Return cached key if already initialized
  if (ENCRYPTION_KEY) {
    return ENCRYPTION_KEY;
  }

  const ENCRYPTION_KEY_ENV = process.env.ENTRA_SSO_ENCRYPTION_KEY;

  if (ENCRYPTION_KEY_ENV) {
    // If base64 encoded, decode it; otherwise use as-is and hash to correct length
    try {
      const decoded = Buffer.from(ENCRYPTION_KEY_ENV, 'base64');
      if (decoded.length === 32) {
        ENCRYPTION_KEY = decoded;
        return ENCRYPTION_KEY;
      }
    } catch {
      // Not base64, fall through to hash
    }
    // Hash the key to ensure correct length
    ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_ENV).digest();
    return ENCRYPTION_KEY;
  }

  // Fail with clear error message when encryption is attempted without key
  const error = new Error(
    'ENTRA_SSO_ENCRYPTION_KEY is required for SSO encryption. ' +
    'Generate with: openssl rand -base64 32'
  );
  logger.error('Encryption key missing:', error.message);
  throw error;
}
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

// Prefix to identify encrypted values (allows backward compatibility)
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Check if a value is already encrypted
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Encrypt a plaintext string
 * Returns format: enc:v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  // Don't double-encrypt
  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  try {
    const key = getEncryptionKey(); // Lazy-load key on first encryption
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: prefix:iv:authTag:ciphertext
    return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt sensitive data');
  }
}

/**
 * Decrypt an encrypted string
 * Handles both encrypted (prefixed) and plaintext (legacy) values
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) {
    return encryptedValue;
  }

  // If not encrypted (legacy data), return as-is
  if (!isEncrypted(encryptedValue)) {
    return encryptedValue;
  }

  try {
    // Remove prefix and parse components
    const withoutPrefix = encryptedValue.slice(ENCRYPTED_PREFIX.length);
    const parts = withoutPrefix.split(':');

    if (parts.length !== 3) {
      logger.error('Invalid encrypted value format');
      throw new Error('Invalid encrypted value format');
    }

    const [ivBase64, authTagBase64, ciphertextBase64] = parts;

    const key = getEncryptionKey(); // Lazy-load key on first decryption
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const ciphertext = Buffer.from(ciphertextBase64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt sensitive data');
  }
}

/**
 * Migrate a plaintext value to encrypted
 * Returns the encrypted value, or the original if already encrypted
 */
export function migrateToEncrypted(value: string): { encrypted: string; wasPlaintext: boolean } {
  if (!value) {
    return { encrypted: value, wasPlaintext: false };
  }

  if (isEncrypted(value)) {
    return { encrypted: value, wasPlaintext: false };
  }

  return { encrypted: encrypt(value), wasPlaintext: true };
}
