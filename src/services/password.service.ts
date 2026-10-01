import crypto from 'crypto';
import argon2 from 'argon2';

export class PasswordService {
  static async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Complexity: >=8 chars, 1 uppercase, 1 number, 1 symbol. */
  static isStrong(password: string): boolean {
    return (
      typeof password === 'string' &&
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }

  /**
   * Generate a random temporary password that passes isStrong().
   * Format: 8 random alphanumerics + "Aa1!" suffix to guarantee complexity.
   */
  static generateTempPassword(): string {
    const raw = crypto
      .randomBytes(8)
      .toString('base64')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 8);
    return `${raw}Aa1!`;
  }
}
