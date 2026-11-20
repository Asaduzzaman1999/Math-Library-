import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../services/customAuthService.ts';
import { verifyTwoFactorSessionToken } from '../services/twoFactorService.ts';
import { db } from '../db/index.ts';
import { securityEvents, userSessions, userTwoFactorSettings, users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export type DbUser = typeof users.$inferSelect;

export interface AuthRequest extends Request {
  dbUser?: DbUser;
  sessionId?: string;
  twoFactorVerified?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorMandatory?: boolean;
}

// 2FA enforcement disabled during testing unless ENABLE_MANDATORY_2FA=true
const ENFORCE_MANDATORY_2FA = process.env.ENABLE_MANDATORY_2FA === 'true';

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || '0.0.0.0';
}

async function resolveBearerUser(token: string) {
  const verified = verifyAuthToken(token);
  if (!verified) return null;

  const [sessionRows, userRows] = await Promise.all([
    db.select().from(userSessions).where(eq(userSessions.sessionId, verified.sessionId)),
    db.select().from(users).where(eq(users.id, verified.userId)),
  ]);

  const session = sessionRows[0];
  const dbUser = userRows[0];
  if (!dbUser || !session) return null;
  if (session.isRevoked) return { dbUser, session, revoked: true as const };

  return { dbUser, session, revoked: false as const };
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const resolved = await resolveBearerUser(token);
    if (resolved && !resolved.revoked) {
      req.dbUser = resolved.dbUser;
      req.sessionId = resolved.session.sessionId;
      const tfaHeader = req.headers['x-2fa-token'];
      req.twoFactorVerified = verifyTwoFactorSessionToken(
        typeof tfaHeader === 'string' ? tfaHeader : undefined,
        resolved.dbUser.id
      );
    }
  } catch {
    // Ignore optional auth error
  }
  next();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please log in to continue' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const resolved = await resolveBearerUser(token);
    if (!resolved) {
      return res.status(401).json({ error: 'Invalid or expired session. Please log in.' });
    }

    const { dbUser, session, revoked } = resolved;
    const ipAddress = getClientIp(req);

    if (revoked) {
      await db.insert(securityEvents).values({
        userId: dbUser.id,
        eventType: 'RevokedSessionAccess',
        severity: 'High',
        ipAddress,
        detailsJson: { sessionId: session.sessionId },
      });
      return res.status(401).json({ error: 'Session has been revoked by Administrator' });
    }

    if (!dbUser.isActive || dbUser.isDeleted) {
      return res.status(403).json({ error: 'Account is suspended or deactivated' });
    }

    await db
      .update(userSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(userSessions.id, session.id));

    const tfaRows = await db
      .select()
      .from(userTwoFactorSettings)
      .where(eq(userTwoFactorSettings.userId, dbUser.id));

    const tfa = tfaRows[0];
    const tfaHeader = req.headers['x-2fa-token'];
    const isTfaVerified = verifyTwoFactorSessionToken(
      typeof tfaHeader === 'string' ? tfaHeader : undefined,
      dbUser.id
    );

    req.dbUser = dbUser;
    req.sessionId = session.sessionId;
    req.twoFactorEnabled = Boolean(tfa?.isEnabled);
    req.twoFactorMandatory = ENFORCE_MANDATORY_2FA && (dbUser.role === 'SuperAdmin' || dbUser.role === 'Teacher');
    req.twoFactorVerified = ENFORCE_MANDATORY_2FA ? isTfaVerified : true;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

export function requireRoles(...allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.dbUser.role)) {
      await db.insert(securityEvents).values({
        userId: req.dbUser.id,
        eventType: 'UnauthorizedRoleAttempt',
        severity: 'High',
        ipAddress: getClientIp(req),
        detailsJson: { required: allowedRoles, actual: req.dbUser.role, path: req.path },
      });
      return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
    }
    next();
  };
}

export function requireMandatory2FA(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.dbUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!ENFORCE_MANDATORY_2FA) {
    return next();
  }
  const mustVerify =
    req.dbUser.role === 'SuperAdmin' ||
    req.dbUser.role === 'Teacher' ||
    Boolean(req.twoFactorEnabled);

  if (mustVerify && !req.twoFactorVerified) {
    return res.status(403).json({
      error: 'Two-factor authentication verification required',
      requires2FA: true,
      twoFactorEnabled: Boolean(req.twoFactorEnabled),
    });
  }
  next();
}
