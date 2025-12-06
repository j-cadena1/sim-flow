/**
 * Encryption Service for sensitive data storage
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';
import { logger } from '../middleware/logger';

// Encryption key from environment (32 bytes for AES-256)
// In production, use: openssl rand -base64 32
const ENCRYPTION_KEY_ENV = process.env.SSO_ENCRYPTION_KEY;

// Derive a 32-byte key from the environment variable or fallback
function getEncryptionKey(): Buffer {
  if (ENCRYPTION_KEY_ENV) {
    // If base64 encoded, decode it; otherwise use as-is and hash to correct length
    try {
      const decoded = Buffer.from(ENCRYPTION_KEY_ENV, 'base64');
      if (decoded.length === 32) {
        return decoded;
      }
    } catch {
      // Not base64, fall through to hash
    }
    // Hash the key to ensure correct length
    return crypto.createHash('sha256').update(ENCRYPTION_KEY_ENV).digest();
  }

  // Development fallback - log warning
  if (process.env.NODE_ENV === 'production') {
    logger.error('SSO_ENCRYPTION_KEY not set in production! SSO secrets will not be properly encrypted.');
  } else {
    logger.warn('SSO_ENCRYPTION_KEY not set. Using development fallback key.');
  }

  // Deterministic fallback for development (DO NOT use in production)
  return crypto.createHash('sha256').update('dev-only-insecure-encryption-key').digest();
}

const ENCRYPTION_KEY = getEncryptionKey();
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
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
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

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const ciphertext = Buffer.from(ciphertextBase64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
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
