import crypto from 'node:crypto';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { db } from '../db/index.ts';
import { recoveryCodes, securityEvents, userTwoFactorSettings } from '../db/schema.ts';
import { and, eq } from 'drizzle-orm';

const FALLBACK_KEY = crypto.randomBytes(32);

function getKeyBytes(): Buffer {
  const raw = process.env.TWO_FACTOR_SECRET || process.env.SESSION_SECRET;
  if (!raw) return FALLBACK_KEY;
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(cipherText: string): string {
  const [ivHex, tagHex, encHex] = cipherText.split(':');
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid encrypted secret format');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKeyBytes(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

export function hashRecoveryCode(code: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(code.toUpperCase(), salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyRecoveryCodeHash(code: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(code.toUpperCase(), salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function createTwoFactorSessionToken(userId: number, ttlSeconds = 7200): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}:${exp}`;
  const sig = crypto.createHmac('sha256', getKeyBytes()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyTwoFactorSessionToken(token: string | undefined, userId: number): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [uidStr, expStr, sig] = decoded.split(':');
    if (Number(uidStr) !== userId) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) return false;
    const expected = crypto
      .createHmac('sha256', getKeyBytes())
      .update(`${uidStr}:${expStr}`)
      .digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(sig || '', 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function initiateTotpEnrollment(userId: number, email: string, isMandatory: boolean) {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: 'Math Library',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  const otpauthUri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 });
  const encrypted = encryptSecret(secret.base32);

  await db
    .insert(userTwoFactorSettings)
    .values({
      userId,
      isEnabled: false,
      isMandatory,
      totpSecretEnc: encrypted,
      failedAttempts: 0,
    })
    .onConflictDoUpdate({
      target: userTwoFactorSettings.userId,
      set: {
        totpSecretEnc: encrypted,
        isMandatory,
        updatedAt: new Date(),
      },
    });

  return {
    secretBase32: secret.base32,
    otpauthUri,
    qrDataUrl,
  };
}

export async function verifyAndActivateTotp(
  userId: number,
  code: string,
  ipAddress: string
): Promise<{ verified: boolean; recoveryCodes?: string[]; twoFactorToken?: string; error?: string }> {
  const rows = await db
    .select()
    .from(userTwoFactorSettings)
    .where(eq(userTwoFactorSettings.userId, userId));
  const settings = rows[0];
  if (!settings || !settings.totpSecretEnc) {
    return { verified: false, error: '2FA enrollment not initialized' };
  }

  if (settings.lockedUntil && settings.lockedUntil > new Date()) {
    return { verified: false, error: 'Too many failed 2FA attempts. Try again later.' };
  }

  const secretBase32 = decryptSecret(settings.totpSecretEnc);
  const totp = new OTPAuth.TOTP({
    issuer: 'Math Library',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });

  const delta = totp.validate({ token: code.replace(/\s+/g, ''), window: 1 });
  if (delta === null) {
    const nextFails = settings.failedAttempts + 1;
    const lockedUntil = nextFails >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await db
      .update(userTwoFactorSettings)
      .set({ failedAttempts: nextFails, lockedUntil, updatedAt: new Date() })
      .where(eq(userTwoFactorSettings.userId, userId));

    await db.insert(securityEvents).values({
      userId,
      eventType: lockedUntil ? 'AccountLocked' : 'TotpFailed',
      severity: lockedUntil ? 'High' : 'Medium',
      ipAddress,
      detailsJson: { failedAttempts: nextFails },
    });
    return { verified: false, error: 'Invalid authenticator code' };
  }

  const wasEnabled = settings.isEnabled;
  await db
    .update(userTwoFactorSettings)
    .set({
      isEnabled: true,
      verifiedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userTwoFactorSettings.userId, userId));

  let plainRecoveryCodes: string[] | undefined;
  if (!wasEnabled) {
    plainRecoveryCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
    await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await db.insert(recoveryCodes).values(
      plainRecoveryCodes.map((c) => ({
        userId,
        codeHash: hashRecoveryCode(c),
      }))
    );
  }

  return {
    verified: true,
    recoveryCodes: plainRecoveryCodes,
    twoFactorToken: createTwoFactorSessionToken(userId),
  };
}

export async function verifyRecoveryCodeLogin(
  userId: number,
  code: string,
  ipAddress: string
): Promise<{ verified: boolean; twoFactorToken?: string; error?: string }> {
  const unused = await db
    .select()
    .from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.isUsed, false)));

  const matched = unused.find((row) => verifyRecoveryCodeHash(code.trim(), row.codeHash));
  if (!matched) {
    await db.insert(securityEvents).values({
      userId,
      eventType: 'RecoveryCodeFailed',
      severity: 'High',
      ipAddress,
      detailsJson: { reason: 'Invalid recovery code' },
    });
    return { verified: false, error: 'Invalid or already used recovery code' };
  }

  await db
    .update(recoveryCodes)
    .set({ isUsed: true, usedAt: new Date() })
    .where(eq(recoveryCodes.id, matched.id));

  await db.insert(securityEvents).values({
    userId,
    eventType: 'RecoveryCodeUsed',
    severity: 'Medium',
    ipAddress,
    detailsJson: { recoveryCodeId: matched.id },
  });

  return {
    verified: true,
    twoFactorToken: createTwoFactorSessionToken(userId),
  };
}
