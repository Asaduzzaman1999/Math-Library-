import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Copy, Check } from 'lucide-react';
import { apiFetch, setTwoFactorToken } from '../lib/apiClient';
import { Lang } from '../lib/i18n';

interface TwoFactorGateProps {
  lang: Lang;
  twoFactorEnabled: boolean;
  isMandatory: boolean;
  onVerified: () => void;
  onClose?: () => void;
}

export const TwoFactorGate: React.FC<TwoFactorGateProps> = ({
  lang,
  twoFactorEnabled,
  isMandatory,
  onVerified,
  onClose,
}) => {
  const [step, setStep] = useState<'enroll' | 'verify' | 'recover' | 'codes'>(
    twoFactorEnabled ? 'verify' : 'enroll'
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secretBase32, setSecretBase32] = useState<string>('');
  const [code, setCode] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const startEnrollment = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/auth/2fa/enroll', { method: 'POST' });
      setQrDataUrl(data.qrDataUrl);
      setSecretBase32(data.secretBase32);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      if (res.twoFactorToken) {
        setTwoFactorToken(res.twoFactorToken);
      }
      if (Array.isArray(res.recoveryCodes) && res.recoveryCodes.length > 0) {
        setRecoveryCodes(res.recoveryCodes);
        setStep('codes');
      } else {
        onVerified();
      }
    } catch (e: any) {
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/auth/2fa/recover', {
        method: 'POST',
        body: JSON.stringify({ recoveryCode: recoveryInput }),
      });
      if (res.twoFactorToken) {
        setTwoFactorToken(res.twoFactorToken);
      }
      onVerified();
    } catch (e: any) {
      setError(e.message || 'Invalid recovery code');
    } finally {
      setLoading(false);
    }
  };

  const copyCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 max-w-lg mx-auto">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-sky-600 dark:text-sky-400 shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'bn' ? 'টু-ফ্যাক্টর প্রমাণীকরণ (TOTP 2FA)' : 'Two-Factor Authentication (TOTP)'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isMandatory
                ? lang === 'bn'
                  ? 'অ্যাডমিন এবং শিক্ষকদের জন্য বাধ্যতামূলক'
                  : 'Mandatory for Super Admin and Teacher accounts'
                : lang === 'bn'
                ? 'আপনার অ্যাকাউন্টের অতিরিক্ত নিরাপত্তা'
                : 'Optional extra security for your account'}
            </p>
          </div>
        </div>
        {onClose && !isMandatory && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {step === 'enroll' && (
        <div className="mt-5 space-y-4">
          {!qrDataUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {lang === 'bn'
                  ? 'Google Authenticator বা Authy অ্যাপ ব্যবহার করে আপনার অ্যাকাউন্ট সুরক্ষিত করুন।'
                  : 'Connect an authenticator app (Google Authenticator, Authy, or 1Password) to generate 6-digit verification codes.'}
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={startEnrollment}
                className="w-full py-2.5 px-4 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium transition-colors"
              >
                {loading
                  ? lang === 'bn'
                    ? 'প্রস্তুত হচ্ছে...'
                    : 'Generating QR...'
                  : lang === 'bn'
                  ? 'QR কোড তৈরি করুন'
                  : 'Generate Authenticator QR Code'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <img
                  src={qrDataUrl}
                  alt="TOTP QR Code"
                  className="w-44 h-44 rounded bg-white p-2"
                />
                <div className="text-center">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'bn' ? 'ম্যানুয়াল সেটআপ কী' : 'Manual setup secret'}
                  </div>
                  <code className="text-xs font-mono text-slate-900 dark:text-slate-100 select-all">
                    {secretBase32}
                  </code>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'অ্যাপ থেকে ৬ সংখ্যার কোড দিন' : 'Enter 6-digit authenticator code'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-center text-lg tracking-widest"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium"
              >
                {loading ? '...' : lang === 'bn' ? 'যাচাই ও সক্রিয় করুন' : 'Verify & Activate 2FA'}
              </button>
            </form>
          )}
        </div>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerify} className="mt-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {lang === 'bn'
              ? 'ড্যাশবোর্ড অ্যাক্সেস করতে আপনার অথেনটিকেটর অ্যাপ থেকে ৬ সংখ্যার কোড লিখুন।'
              : 'Enter the 6-digit code from your authenticator app to unlock privileged operations.'}
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-center text-xl tracking-widest"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium"
          >
            {loading ? '...' : lang === 'bn' ? 'যাচাই করুন' : 'Verify 2FA Code'}
          </button>
          <button
            type="button"
            onClick={() => setStep('recover')}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-sky-600"
          >
            <KeyRound className="w-3.5 h-3.5" />
            {lang === 'bn' ? 'রিকভারি কোড ব্যবহার করুন' : 'Use a single-use recovery code'}
          </button>
        </form>
      )}

      {step === 'recover' && (
        <form onSubmit={handleRecover} className="mt-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {lang === 'bn'
              ? 'আপনার সংরক্ষিত ৮-অক্ষরের রিকভারি কোডটি লিখুন।'
              : 'Enter one of your saved 8-character single-use recovery codes.'}
          </p>
          <input
            type="text"
            required
            value={recoveryInput}
            onChange={(e) => setRecoveryInput(e.target.value)}
            placeholder="A1B2C3D4"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-center uppercase"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('verify')}
              className="flex-1 py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
            >
              {lang === 'bn' ? 'ফিরে যান' : 'Back'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-3 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
            >
              {lang === 'bn' ? 'রিকভার করুন' : 'Verify Recovery Code'}
            </button>
          </div>
        </form>
      )}

      {step === 'codes' && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-3 text-xs text-amber-800 dark:text-amber-200">
            {lang === 'bn'
              ? 'নিচের রিকভারি কোডগুলো নিরাপদ স্থানে সংরক্ষণ করুন। প্রতিটি কোড মাত্র একবার ব্যবহার করা যাবে।'
              : 'Save these 8 single-use recovery codes in a safe place. They will not be shown again.'}
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <div
                key={c}
                className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center"
              >
                {c}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyCodes}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : lang === 'bn' ? 'কপি করুন' : 'Copy Codes'}
            </button>
            <button
              type="button"
              onClick={onVerified}
              className="flex-1 py-2 px-3 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
            >
              {lang === 'bn' ? 'চালিয়ে যান' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
