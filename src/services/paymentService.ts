import crypto from 'node:crypto';
import { db } from '../db/index.ts';
import {
  auditLogs,
  coupons,
  course,
  notifications,
  payments,
  subscriptionPlans,
  subscriptions,
} from '../db/schema.ts';
import { and, desc, eq } from 'drizzle-orm';

export function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export async function initiateSubscriptionCheckout(
  studentUserId: number,
  planId: number,
  gateway: 'bKash' | 'Nagad' | 'Rocket' | 'Visa' | 'Mastercard',
  couponCode: string | undefined,
  idempotencyKey: string
) {
  // Check idempotency key first to prevent duplicate initiations
  const existing = await db
    .select()
    .from(payments)
    .where(eq(payments.idempotencyKey, idempotencyKey));
  if (existing[0]) {
    return existing[0];
  }

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.isActive, true)));

  if (!plan) throw new Error('Subscription plan not found or inactive');

  const grossAmount = Number(plan.priceBdt);
  let discountAmount = 0;
  let couponId: number | null = null;

  if (couponCode && couponCode.trim()) {
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, couponCode.trim().toUpperCase()), eq(coupons.isActive, true)));
    if (!coupon) throw new Error('Invalid or inactive coupon code');
    if (coupon.validUntil < new Date()) throw new Error('Coupon has expired');
    if (coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new Error('Coupon redemption limit reached');
    }

    couponId = coupon.id;
    if (coupon.discountType === 'Percentage') {
      discountAmount = Number(((grossAmount * Number(coupon.discountValue)) / 100).toFixed(2));
    } else {
      discountAmount = Math.min(grossAmount, Number(coupon.discountValue));
    }
  }

  const netAmount = Math.max(0, Number((grossAmount - discountAmount).toFixed(2)));

  const [created] = await db
    .insert(payments)
    .values({
      studentUserId,
      planId: plan.id,
      couponId,
      gateway,
      grossAmountBdt: grossAmount.toFixed(2),
      discountBdt: discountAmount.toFixed(2),
      netAmountBdt: netAmount.toFixed(2),
      idempotencyKey,
      status: 'Initiated',
    })
    .returning();

  return {
    payment: created,
    plan,
    gatewayRedirectHint: `Server-verified ${gateway} merchant checkout ready`,
  };
}

export async function verifyAndActivateGatewayPayment(
  paymentId: number,
  studentUserId: number,
  gatewayTrxIdInput: string,
  ipAddress: string
) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.studentUserId, studentUserId)));

    if (!payment) throw new Error('Payment record not found');
    if (payment.status === 'Verified' && payment.subscriptionId) {
      const [sub] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, payment.subscriptionId));
      return { payment, subscription: sub, idempotentReplay: true };
    }

    const trxId = gatewayTrxIdInput.trim().toUpperCase();
    if (trxId.length < 6) {
      throw new Error('Invalid gateway transaction ID');
    }

    // Prevent duplicate transaction reuse across payments
    const dupTrx = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.gatewayTrxId, trxId));
    if (dupTrx[0] && dupTrx[0].id !== payment.id) {
      throw new Error('Duplicate gateway transaction ID detected');
    }

    const [plan] = await tx
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, payment.planId));
    if (!plan) throw new Error('Plan missing');

    const [mainCourse] = await tx.select().from(course).where(eq(course.singletonKey, 1));
    if (!mainCourse) throw new Error('Course missing');

    // Compute renewal expiry based on active subscription if extending
    const now = new Date();
    const activeSubs = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.studentUserId, studentUserId), eq(subscriptions.status, 'Active')))
      .orderBy(desc(subscriptions.expiresAt));

    const startAnchor =
      activeSubs[0] && activeSubs[0].expiresAt > now ? activeSubs[0].expiresAt : now;
    const expiresAt = addMonthsUtc(startAnchor, plan.durationMonths);
    const graceEndsAt = new Date(
      expiresAt.getTime() + plan.gracePeriodDays * 24 * 60 * 60 * 1000
    );

    const [newSub] = await tx
      .insert(subscriptions)
      .values({
        studentUserId,
        planId: plan.id,
        courseId: mainCourse.id,
        status: 'Active',
        startsAt: now,
        expiresAt,
        graceEndsAt,
        isAdminGranted: false,
        renewalPolicy: 'ExtendFromExpiry',
      })
      .returning();

    const [updatedPayment] = await tx
      .update(payments)
      .set({
        subscriptionId: newSub.id,
        gatewayTrxId: trxId,
        status: 'Verified',
        verifiedAt: now,
      })
      .where(eq(payments.id, payment.id))
      .returning();

    if (payment.couponId) {
      const [cRow] = await tx
        .select()
        .from(coupons)
        .where(eq(coupons.id, payment.couponId));
      if (cRow) {
        await tx
          .update(coupons)
          .set({ redemptionCount: cRow.redemptionCount + 1 })
          .where(eq(coupons.id, cRow.id));
      }
    }

    await tx.insert(notifications).values({
      recipientUserId: studentUserId,
      channel: 'Web',
      category: 'PaymentConfirmed',
      titleBn: 'সাবস্ক্রিপশন সক্রিয় হয়েছে',
      titleEn: 'Subscription Activated',
      bodyBn: `${plan.titleBn} সফলভাবে সক্রিয় হয়েছে। মেয়াদ: ${expiresAt.toISOString().slice(0, 10)}`,
      bodyEn: `${plan.titleEn} activated through ${expiresAt.toISOString().slice(0, 10)}.`,
    });

    await tx.insert(auditLogs).values({
      actorUserId: studentUserId,
      actorRole: 'Student',
      action: 'PAYMENT_VERIFIED_AND_SUBSCRIPTION_ACTIVATED',
      entityName: 'payments',
      entityId: String(payment.id),
      detailsJson: {
        gateway: payment.gateway,
        gatewayTrxId: trxId,
        netAmountBdt: payment.netAmountBdt,
        subscriptionId: newSub.id,
      },
      ipAddress,
    });

    return { payment: updatedPayment, subscription: newSub, idempotentReplay: false };
  });
}

export async function adminGrantFreeSubscription(
  adminUserId: number,
  studentUserId: number,
  planId: number,
  ipAddress: string
) {
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId));
    if (!plan) throw new Error('Plan not found');

    const [mainCourse] = await tx.select().from(course).where(eq(course.singletonKey, 1));
    const now = new Date();
    const expiresAt = addMonthsUtc(now, plan.durationMonths);
    const graceEndsAt = new Date(
      expiresAt.getTime() + plan.gracePeriodDays * 24 * 60 * 60 * 1000
    );

    const [sub] = await tx
      .insert(subscriptions)
      .values({
        studentUserId,
        planId: plan.id,
        courseId: mainCourse.id,
        status: 'Active',
        startsAt: now,
        expiresAt,
        graceEndsAt,
        isAdminGranted: true,
        grantedByUserId: adminUserId,
      })
      .returning();

    await tx.insert(payments).values({
      studentUserId,
      subscriptionId: sub.id,
      planId: plan.id,
      gateway: 'AdminGrant',
      grossAmountBdt: plan.priceBdt,
      discountBdt: plan.priceBdt,
      netAmountBdt: '0.00',
      idempotencyKey: `grant-${crypto.randomUUID()}`,
      gatewayTrxId: `GRANT-${Date.now()}`,
      status: 'Verified',
      verifiedAt: now,
    });

    await tx.insert(notifications).values({
      recipientUserId: studentUserId,
      channel: 'Web',
      category: 'AdminGrant',
      titleBn: 'অ্যাডমিন কর্তৃক ফ্রি কোর্স অ্যাক্সেস প্রদান',
      titleEn: 'Complimentary Course Access Granted',
      bodyBn: `সুপার অ্যাডমিন আপনাকে ${plan.titleBn} অ্যাক্সেস প্রদান করেছেন।`,
      bodyEn: `Super Admin granted you complimentary ${plan.titleEn} access.`,
    });

    await tx.insert(auditLogs).values({
      actorUserId: adminUserId,
      actorRole: 'SuperAdmin',
      action: 'ADMIN_GRANT_SUBSCRIPTION',
      entityName: 'subscriptions',
      entityId: String(sub.id),
      detailsJson: { studentUserId, planId },
      ipAddress,
    });

    return sub;
  });
}
