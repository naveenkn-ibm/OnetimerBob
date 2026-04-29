/**
 * Encrypts a string using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex-encoded)
 */
export declare function encrypt(plaintext: string): string;
/**
 * Decrypts a string encrypted with the encrypt function
 * @param encryptedData - Encrypted string in format: iv:authTag:encryptedData
 * @returns Decrypted plaintext
 */
export declare function decrypt(encryptedData: string): string;
/**
 * Hashes a password using bcrypt (for comparison, not storage of TSO passwords)
 * @param password - Password to hash
 * @returns Hashed password
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Compares a password with a hashed password
 * @param password - Plain password
 * @param hashedPassword - Hashed password
 * @returns True if passwords match
 */
export declare function comparePassword(password: string, hashedPassword: string): Promise<boolean>;
/**
 * Generates a secure random token
 * @param length - Length of the token in bytes (default: 32)
 * @returns Hex-encoded random token
 */
export declare function generateToken(length?: number): string;
/**
 * Creates a hash of data (for integrity checks)
 * @param data - Data to hash
 * @returns SHA-256 hash
 */
export declare function createHash(data: string): string;
/**
 * Sanitizes sensitive data for logging
 * @param data - Data to sanitize
 * @returns Sanitized data with sensitive fields masked
 */
export declare function sanitizeForLogging(data: any): any;
//# sourceMappingURL=encryption.d.ts.map