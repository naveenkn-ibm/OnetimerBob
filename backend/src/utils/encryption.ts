import crypto from 'crypto';

/**
 * Encryption utility for sensitive data (TSO passwords, credentials)
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'onetimer-bob-salt'; // In production, use unique salt per encryption

/**
 * Derives a 32-byte key from the encryption key environment variable
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
  
  // Derive a consistent 32-byte key using scrypt
  return crypto.scryptSync(key, SALT, 32);
}

/**
 * Encrypts a string using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex-encoded)
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts a string encrypted with the encrypt function
 * @param encryptedData - Encrypted string in format: iv:authTag:encryptedData
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    
    // Parse the encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Hashes a password using bcrypt (for comparison, not storage of TSO passwords)
 * @param password - Password to hash
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = require('bcrypt');
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compares a password with a hashed password
 * @param password - Plain password
 * @param hashedPassword - Hashed password
 * @returns True if passwords match
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  const bcrypt = require('bcrypt');
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Generates a secure random token
 * @param length - Length of the token in bytes (default: 32)
 * @returns Hex-encoded random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Creates a hash of data (for integrity checks)
 * @param data - Data to hash
 * @returns SHA-256 hash
 */
export function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Sanitizes sensitive data for logging
 * @param data - Data to sanitize
 * @returns Sanitized data with sensitive fields masked
 */
export function sanitizeForLogging(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'credentials', 'encryptedPassword'];
  const sanitized = { ...data };
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }
  
  return sanitized;
}

// Made with Bob
