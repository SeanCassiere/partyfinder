import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const TTL = 12 * 60 * 60 * 1000;
export class Sessions {
  private key: Buffer;
  constructor(secret: string) {
    this.key = createHash('sha256').update(secret).digest();
  }
  seal(password: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([
      cipher.update(JSON.stringify({ password, expires: Date.now() + TTL })),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
  }
  open(token: string | undefined): string | null {
    if (!token || token.length > 8000) return null;
    try {
      const bytes = Buffer.from(token, 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const data = JSON.parse(
        Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString(),
      );
      return typeof data.password === 'string' && data.expires > Date.now() ? data.password : null;
    } catch {
      return null;
    }
  }
}
