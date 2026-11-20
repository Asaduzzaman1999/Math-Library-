import crypto from 'node:crypto';
import { db } from '../db/index.ts';
import {
  auditLogs,
  passwordResetTokens,
  securityEvents,
  userSessions,
  userTwoFactorSettings,
  users,
} from '../db/schema.ts';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { hasAnySuperAdmin, UserRole } from './authorizationService.ts';

const FALLBACK_AUTH_SECRET = crypto.randomBytes(32);

function getAuthSecret(): Buffer | string {
  return process.env.SESSION_SECRET || FALLBACK_AUTH_SECRET;
}

export function sanitizeUser(user: typeof users.$inferSelect) {
  const { passwordHash: _ph, recoveryPinHash, ...safe } = user;
  return {
    ...safe,
    hasRecoveryPin: Boolean(recoveryPinHash),
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function hashResetCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

function constantTimeHexEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function signAuthToken(userId: number, sessionId: string, ttlSeconds = 7 * 24 * 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `ML1.${userId}.${sessionId}.${exp}`;
  const sig = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAuthToken(
  token: string
): { userId: number; sessionId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 5 || parts[0] !== 'ML1') return null;
    const [, uidStr, sessionId, expStr, sig] = parts;
    const userId = Number(uidStr);
    const exp = Number(expStr);
    if (!Number.isFinite(userId) || !Number.isFinite(exp)) return null;
    if (Math.floor(Date.now() / 1000) > exp) return null;

    const payload = `ML1.${uidStr}.${sessionId}.${expStr}`;
    const expectedSig = crypto
      .createHmac('sha256', getAuthSecret())
      .update(payload)
      .digest('base64url');

    const a = Buffer.from(expectedSig, 'utf8');
    const b = Buffer.from(sig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    return { userId, sessionId };
  } catch {
    return null;
  }
}

export async function registerUserAccount(params: {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  recoveryPin?: string;
  institution?: string;
  targetTrack?: string;
  claimSuperAdmin?: boolean;
  ipAddress: string;
  userAgent: string;
}) {
  const fullName = params.fullName.trim();
  const email = params.email.trim().toLowerCase();
  const phoneNumber = params.phoneNumber.trim();
  const password = params.password;
  const recoveryPin = params.recoveryPin?.trim() || '';

  if (fullName.length < 2) throw new Error('Full name is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid email address is required');
  if (phoneNumber.replace(/\D/g, '').length < 10) {
    throw new Error('Valid phone number (at least 10 digits) is required');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  if (recoveryPin && recoveryPin.length < 4) {
    throw new Error('Recovery PIN must be at least 4 characters');
  }

  const existing = await db
    .select({ id: users.id, email: users.email, phoneNumber: users.phoneNumber })
    .from(users)
    .where(or(eq(users.email, email), eq(users.phoneNumber, phoneNumber)));

  if (existing.length > 0) {
    throw new Error('An account with this email or phone number already exists. Please log in.');
  }

  let role: UserRole = 'Student';
  if (params.claimSuperAdmin) {
    const adminExists = await hasAnySuperAdmin();
    if (!adminExists) {
      role = 'SuperAdmin';
    }
  }

  const passwordHash = hashPassword(password);
  const recoveryPinHash = recoveryPin ? hashPassword(recoveryPin) : null;
  const uid = `local:${crypto.randomUUID()}`;

  const [created] = await db
    .insert(users)
    .values({
      uid,
      email,
      fullName: fullName.slice(0, 150),
      phoneNumber: phoneNumber.slice(0, 30),
      passwordHash,
      recoveryPinHash,
      role,
      institution: params.institution?.trim().slice(0, 190) || null,
      targetTrack: params.targetTrack?.trim().slice(0, 110) || null,
      preferredLanguage: 'bn',
      themePreference: 'light',
    })
    .returning();

  await db
    .insert(userTwoFactorSettings)
    .values({
      userId: created.id,
      isEnabled: false,
      isMandatory: false,
    })
    .onConflictDoNothing();

  const sessionId = crypto.randomBytes(24).toString('hex');
  await db.insert(userSessions).values({
    userId: created.id,
    sessionId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent.slice(0, 300),
    isRevoked: false,
  });

  await db.insert(auditLogs).values({
    actorUserId: created.id,
    actorRole: created.role,
    action: 'USER_REGISTERED',
    entityName: 'users',
    entityId: String(created.id),
    ipAddress: params.ipAddress,
  });

  const authToken = signAuthToken(created.id, sessionId);
  return { user: sanitizeUser(created), authToken };
}

export async function loginUserAccount(params: {
  identifier: string;
  password: string;
  ipAddress: string;
  userAgent: string;
}) {
  const rawId = params.identifier.trim();
  const normalizedEmail = rawId.toLowerCase();

  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.email, normalizedEmail), eq(users.phoneNumber, rawId)));

  const user = rows[0];
  if (!user || user.isDeleted) {
    await db.insert(securityEvents).values({
      eventType: 'LoginFailed',
      severity: 'Low',
      ipAddress: params.ipAddress,
      detailsJson: { reason: 'Unregistered account', identifier: rawId.slice(0, 60) },
    });
    throw new Error('Account not found. Please register with your name, email, and phone first.');
  }

  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  if (!verifyPassword(params.password, user.passwordHash)) {
    await db.insert(securityEvents).values({
      userId: user.id,
      eventType: 'LoginFailed',
      severity: 'Medium',
      ipAddress: params.ipAddress,
      detailsJson: { reason: 'Invalid password' },
    });
    throw new Error('Invalid email/phone or password');
  }

  const sessionId = crypto.randomBytes(24).toString('hex');
  await db.insert(userSessions).values({
    userId: user.id,
    sessionId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent.slice(0, 300),
    isRevoked: false,
  });

  const authToken = signAuthToken(user.id, sessionId);
  return { user: sanitizeUser(user), authToken };
}

export async function adminCreateManagedUser(params: {
  adminUserId: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'Teacher' | 'Student';
  designation?: string;
  ipAddress: string;
}) {
  const email = params.email.trim().toLowerCase();
  const phoneNumber = params.phoneNumber.trim();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, email), eq(users.phoneNumber, phoneNumber)));
  if (existing.length > 0) {
    throw new Error('Email or phone already registered');
  }

  const [created] = await db
    .insert(users)
    .values({
      uid: `local:${crypto.randomUUID()}`,
      email,
      fullName: params.fullName.trim().slice(0, 150),
      phoneNumber: phoneNumber.slice(0, 30),
      passwordHash: hashPassword(params.password),
      role: params.role,
      designation: params.designation?.trim().slice(0, 120) || null,
      preferredLanguage: 'bn',
      themePreference: 'light',
    })
    .returning();

  await db
    .insert(userTwoFactorSettings)
    .values({
      userId: created.id,
      isEnabled: false,
      isMandatory: false,
    })
    .onConflictDoNothing();

  await db.insert(auditLogs).values({
    actorUserId: params.adminUserId,
    actorRole: 'SuperAdmin',
    action: 'ADMIN_CREATED_USER',
    entityName: 'users',
    entityId: String(created.id),
    detailsJson: { role: params.role },
    ipAddress: params.ipAddress,
  });

  return sanitizeUser(created);
}

export async function updateUserRecoveryPin(params: {
  userId: number;
  currentPassword: string;
  newRecoveryPin: string;
  ipAddress: string;
}) {
  const pin = params.newRecoveryPin.trim();
  if (pin.length < 4 || pin.length > 24) {
    throw new Error('Recovery PIN must be between 4 and 24 characters');
  }

  const [user] = await db.select().from(users).where(eq(users.id, params.userId));
  if (!user || user.isDeleted) {
    throw new Error('User not found');
  }
  if (!verifyPassword(params.currentPassword, user.passwordHash)) {
    throw new Error('Current password is incorrect');
  }

  await db
    .update(users)
    .set({ recoveryPinHash: hashPassword(pin), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'RECOVERY_PIN_UPDATED',
    entityName: 'users',
    entityId: String(user.id),
    ipAddress: params.ipAddress,
  });

  return { success: true };
}

export async function resetPasswordWithRecoveryPin(params: {
  identifier: string;
  phoneNumber: string;
  recoveryPin: string;
  newPassword: string;
  ipAddress: string;
}) {
  const rawId = params.identifier.trim();
  const normalizedEmail = rawId.toLowerCase();
  const phone = params.phoneNumber.trim();
  const pin = params.recoveryPin.trim();
  const newPassword = params.newPassword;

  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }

  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.email, normalizedEmail), eq(users.phoneNumber, rawId)));
  const user = rows[0];

  if (!user || user.isDeleted || !user.isActive) {
    throw new Error('Invalid recovery details. Check email, phone number, and Recovery PIN.');
  }

  const phoneDigits = (user.phoneNumber || '').replace(/\D/g, '');
  const inputDigits = phone.replace(/\D/g, '');
  if (!phoneDigits || phoneDigits !== inputDigits || !verifyPassword(pin, user.recoveryPinHash)) {
    await db.insert(securityEvents).values({
      userId: user.id,
      eventType: 'PasswordRecoveryFailed',
      severity: 'Medium',
      ipAddress: params.ipAddress,
      detailsJson: { method: 'RecoveryPIN' },
    });
    throw new Error('Invalid recovery details. Check email, phone number, and Recovery PIN.');
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await db
    .update(userSessions)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(eq(userSessions.userId, user.id));

  await db.insert(securityEvents).values({
    userId: user.id,
    eventType: 'PasswordReset',
    severity: 'Medium',
    ipAddress: params.ipAddress,
    detailsJson: { method: 'RecoveryPIN' },
  });

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'PASSWORD_RESET_PIN',
    entityName: 'users',
    entityId: String(user.id),
    ipAddress: params.ipAddress,
  });

  return { success: true };
}

export async function issuePasswordResetCode(params: {
  targetUserId: number;
  issuedByUserId: number | null;
  channel: 'AdminIssued' | 'EmailOtp';
  ipAddress: string;
}) {
  const [user] = await db.select().from(users).where(eq(users.id, params.targetUserId));
  if (!user || user.isDeleted) {
    throw new Error('Target user not found');
  }

  // Expire any prior unused tokens
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    codeHash: hashResetCode(code),
    channel: params.channel,
    expiresAt,
    issuedByUserId: params.issuedByUserId,
  });

  await db.insert(auditLogs).values({
    actorUserId: params.issuedByUserId || user.id,
    actorRole: params.issuedByUserId ? 'SuperAdmin' : user.role,
    action: 'PASSWORD_RESET_CODE_ISSUED',
    entityName: 'users',
    entityId: String(user.id),
    detailsJson: { channel: params.channel },
    ipAddress: params.ipAddress,
  });

  return { code, expiresAt, email: user.email, fullName: user.fullName };
}

export async function requestEmailPasswordResetCode(params: {
  email: string;
  ipAddress: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error(
      'Email OTP delivery is not configured. Please reset using your Recovery PIN or contact Super Admin for a one-time reset code.'
    );
  }

  const normalized = params.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalized));
  if (user && !user.isDeleted && user.isActive) {
    const issued = await issuePasswordResetCode({
      targetUserId: user.id,
      issuedByUserId: null,
      channel: 'EmailOtp',
      ipAddress: params.ipAddress,
    });

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Math Library <onboarding@resend.dev>';
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [user.email],
        subject: 'Math Library Password Recovery Code',
        text: `Your Math Library password recovery code is: ${issued.code}. It expires in 15 minutes.`,
      }),
    });
    if (!resp.ok) {
      throw new Error('Failed to deliver recovery email');
    }
  }

  return { sent: true };
}

export async function resetPasswordWithCode(params: {
  identifier: string;
  resetCode: string;
  newPassword: string;
  ipAddress: string;
}) {
  const rawId = params.identifier.trim();
  const normalizedEmail = rawId.toLowerCase();
  const code = params.resetCode.trim();
  const newPassword = params.newPassword;

  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }
  if (!code || code.length < 6) {
    throw new Error('Valid 6-digit recovery code is required');
  }

  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.email, normalizedEmail), eq(users.phoneNumber, rawId)));
  const user = rows[0];
  if (!user || user.isDeleted || !user.isActive) {
    throw new Error('Invalid or expired recovery code');
  }

  const tokenRows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);

  const token = tokenRows[0];
  if (!token || token.attempts >= 5) {
    throw new Error('Invalid or expired recovery code');
  }

  const providedHash = hashResetCode(code);
  if (!constantTimeHexEqual(providedHash, token.codeHash)) {
    await db
      .update(passwordResetTokens)
      .set({ attempts: token.attempts + 1 })
      .where(eq(passwordResetTokens.id, token.id));
    await db.insert(securityEvents).values({
      userId: user.id,
      eventType: 'PasswordRecoveryFailed',
      severity: 'Medium',
      ipAddress: params.ipAddress,
      detailsJson: { method: 'ResetCode', attempts: token.attempts + 1 },
    });
    throw new Error('Invalid or expired recovery code');
  }

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, token.id));

  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await db
    .update(userSessions)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(eq(userSessions.userId, user.id));

  await db.insert(securityEvents).values({
    userId: user.id,
    eventType: 'PasswordReset',
    severity: 'Medium',
    ipAddress: params.ipAddress,
    detailsJson: { method: token.channel },
  });

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'PASSWORD_RESET_CODE',
    entityName: 'users',
    entityId: String(user.id),
    ipAddress: params.ipAddress,
  });

  return { success: true };
}
