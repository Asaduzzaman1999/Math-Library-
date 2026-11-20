import { db } from '../db/index.ts';
import {
  securityEvents,
  subUnits,
  subscriptions,
  teacherAssignments,
  topics,
  userTwoFactorSettings,
  users,
} from '../db/schema.ts';
import { and, desc, eq, inArray, or } from 'drizzle-orm';

export type UserRole = 'SuperAdmin' | 'Teacher' | 'Student';

export async function upsertFirebaseUser(uid: string, email: string, fullName: string) {
  const existing = await db.select().from(users).where(eq(users.uid, uid));
  if (existing[0]) {
    const updated = await db
      .update(users)
      .set({
        email,
        fullName: fullName || existing[0].fullName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id))
      .returning();
    return updated[0];
  }

  const configuredAdminEmail = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const isInitialAdmin = configuredAdminEmail && email.toLowerCase() === configuredAdminEmail;
  const assignedRole: UserRole = isInitialAdmin ? 'SuperAdmin' : 'Student';

  const inserted = await db
    .insert(users)
    .values({
      uid,
      email,
      fullName: fullName || email.split('@')[0],
      role: assignedRole,
      preferredLanguage: 'bn',
      themePreference: 'light',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: { email, updatedAt: new Date() },
    })
    .returning();

  const user = inserted[0];
  await db
    .insert(userTwoFactorSettings)
    .values({
      userId: user.id,
      isEnabled: false,
      isMandatory: assignedRole !== 'Student',
    })
    .onConflictDoNothing();

  return user;
}

export async function hasAnySuperAdmin(): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'SuperAdmin'), eq(users.isDeleted, false)))
    .limit(1);
  return rows.length > 0;
}

export async function hasActiveCourseAccess(userId: number, role: string) {
  if (role === 'SuperAdmin' || role === 'Teacher') {
    return { hasAccess: true, status: 'StaffAccess', subscription: null };
  }

  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.studentUserId, userId),
        inArray(subscriptions.status, ['Active', 'GracePeriod'])
      )
    )
    .orderBy(desc(subscriptions.expiresAt));

  const now = new Date();
  for (const sub of rows) {
    if (sub.expiresAt > now) {
      return { hasAccess: true, status: 'Active', subscription: sub };
    }
    if (sub.graceEndsAt > now) {
      if (sub.status !== 'GracePeriod') {
        await db
          .update(subscriptions)
          .set({ status: 'GracePeriod', updatedAt: now })
          .where(eq(subscriptions.id, sub.id));
      }
      return { hasAccess: true, status: 'GracePeriod', subscription: sub };
    }
    // Automatically expire outdated subscription
    await db
      .update(subscriptions)
      .set({ status: 'Expired', updatedAt: now })
      .where(eq(subscriptions.id, sub.id));
  }

  return { hasAccess: false, status: 'NoActiveSubscription', subscription: null };
}

export async function getTeacherAssignedTopicIds(teacherUserId: number): Promise<{
  topicIds: number[];
  assignments: (typeof teacherAssignments.$inferSelect)[];
}> {
  const assignments = await db
    .select()
    .from(teacherAssignments)
    .where(
      and(
        eq(teacherAssignments.teacherUserId, teacherUserId),
        eq(teacherAssignments.isActive, true)
      )
    );

  if (assignments.length === 0) {
    return { topicIds: [], assignments: [] };
  }

  const directTopicIds = new Set<number>();
  const subUnitIds = new Set<number>();
  const unitIds = new Set<number>();

  for (const a of assignments) {
    if (a.scopeType === 'Topic' && a.topicId) directTopicIds.add(a.topicId);
    if (a.scopeType === 'SubUnit' && a.subUnitId) subUnitIds.add(a.subUnitId);
    if (a.scopeType === 'Unit' && a.unitId) unitIds.add(a.unitId);
  }

  if (unitIds.size > 0) {
    const suRows = await db
      .select({ id: subUnits.id })
      .from(subUnits)
      .where(inArray(subUnits.unitId, Array.from(unitIds)));
    suRows.forEach((r) => subUnitIds.add(r.id));
  }

  if (subUnitIds.size > 0) {
    const tRows = await db
      .select({ id: topics.id })
      .from(topics)
      .where(inArray(topics.subUnitId, Array.from(subUnitIds)));
    tRows.forEach((r) => directTopicIds.add(r.id));
  }

  return {
    topicIds: Array.from(directTopicIds),
    assignments,
  };
}

export async function assertTeacherTopicScope(
  userId: number,
  role: string,
  topicId: number,
  permission: 'canManageContent' | 'canManageExams' | 'canEvaluateScripts',
  ipAddress: string
): Promise<boolean> {
  if (role === 'SuperAdmin') return true;
  if (role !== 'Teacher') return false;

  const topicRows = await db.select().from(topics).where(eq(topics.id, topicId));
  const topic = topicRows[0];
  if (!topic) return false;

  const subUnitRows = await db.select().from(subUnits).where(eq(subUnits.id, topic.subUnitId));
  const subUnit = subUnitRows[0];
  if (!subUnit) return false;

  const matching = await db
    .select()
    .from(teacherAssignments)
    .where(
      and(
        eq(teacherAssignments.teacherUserId, userId),
        eq(teacherAssignments.isActive, true),
        or(
          eq(teacherAssignments.topicId, topicId),
          eq(teacherAssignments.subUnitId, subUnit.id),
          eq(teacherAssignments.unitId, subUnit.unitId)
        )
      )
    );

  const permitted = matching.some((a) => a[permission]);
  if (!permitted) {
    await db.insert(securityEvents).values({
      userId,
      eventType: 'ForbiddenResourceAccess',
      severity: 'High',
      ipAddress,
      detailsJson: { topicId, permission },
    });
  }
  return permitted;
}
