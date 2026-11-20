import React, { useState } from 'react';
import { CreditCard, CheckCircle2, X } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { Lang, pick } from '../lib/i18n';

export interface PlanItem {
  id: number;
  planCode: string;
  titleBn: string;
  titleEn: string;
  durationMonths: number;
  priceBdt: string;
  gracePeriodDays: number;
}

interface SubscriptionCheckoutModalProps {
  lang: Lang;
  plan: PlanItem;
  onClose: () => void;
  onSuccess: () => void;
}

const GATEWAYS = ['bKash', 'Nagad', 'Rocket', 'Visa', 'Mastercard'] as const;

export const SubscriptionCheckoutModal: React.FC<SubscriptionCheckoutModalProps> = ({
  lang,
  plan,
  onClose,
  onSuccess,
}) => {
  const [gateway, setGateway] = useState<(typeof GATEWAYS)[number]>('bKash');
  const [couponCode, setCouponCode] = useState('');
  const [initiatedPayment, setInitiatedPayment] = useState<any>(null);
  const [trxId, setTrxId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const idempotencyKey = `sub-${plan.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const res = await apiFetch('/api/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.id,
          gateway,
          couponCode: couponCode.trim() || undefined,
          idempotencyKey,
        }),
      });
      setInitiatedPayment(res.payment);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initiatedPayment) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/subscriptions/verify', {
        method: 'POST',
        body: JSON.stringify({
          paymentId: initiatedPayment.id,
          gatewayTrxId: trxId,
        }),
      });
      setDone(true);
      setTimeout(() => {
        onSuccess();
      }, 900);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {pick(plan.titleBn, plan.titleEn, lang)}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {done ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'bn' ? 'পেমেন্ট যাচাই ও সাবস্ক্রিপশন সক্রিয় হয়েছে!' : 'Payment Verified & Subscription Active'}
            </div>
          </div>
        ) : !initiatedPayment ? (
          <form onSubmit={handleInitiate} className="mt-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                {lang === 'bn' ? 'মূল্য (ম্যাথ লাইব্রেরি কোর্স)' : 'Course Subscription Price'}
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                ৳{Number(plan.priceBdt).toLocaleString()}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                {lang === 'bn' ? 'পেমেন্ট গেটওয়ে নির্বাচন করুন' : 'Select Bangladesh Payment Gateway'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GATEWAYS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGateway(g)}
                    className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors ${
                      gateway === g
                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'bn' ? 'কুপন কোড (ঐচ্ছিক, যেমন: MATH20)' : 'Coupon Code (optional, e.g. MATH20)'}
              </label>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="MATH20"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-sm uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium"
            >
              {loading
                ? '...'
                : lang === 'bn'
                ? `${gateway} দিয়ে পেমেন্ট শুরু করুন`
                : `Proceed to ${gateway} Checkout`}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-5 space-y-4">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{lang === 'bn' ? 'গেটওয়ে' : 'Gateway'}</span>
                <span className="font-semibold">{initiatedPayment.gateway}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{lang === 'bn' ? 'ডিসকাউন্ট' : 'Discount'}</span>
                <span className="font-mono">-৳{initiatedPayment.discountBdt}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>{lang === 'bn' ? 'সর্বমোট পরিশোধযোগ্য' : 'Net Payable'}</span>
                <span className="font-mono text-sky-700 dark:text-sky-400">
                  ৳{initiatedPayment.netAmountBdt}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'bn'
                  ? `${initiatedPayment.gateway} ট্রানজেকশন আইডি (TrxID) লিখুন`
                  : `Enter ${initiatedPayment.gateway} Gateway Transaction ID (TrxID)`}
              </label>
              <input
                type="text"
                required
                minLength={6}
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                placeholder="BKH9A82716X"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-sm uppercase"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {lang === 'bn'
                  ? 'সার্ভার-সাইড ট্রানজেকশন যাচাইয়ের পরপরই সাবস্ক্রিপশন সক্রিয় হবে।'
                  : 'Subscription activates only after server-side transaction verification and duplicate check.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              {loading
                ? '...'
                : lang === 'bn'
                ? 'সার্ভারের মাধ্যমে পেমেন্ট যাচাই করুন'
                : 'Verify Transaction Server-Side'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
