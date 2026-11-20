import React, { useEffect, useState } from 'react';
import { UserPlus, LogIn, X, Shield, KeyRound, ArrowLeft } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/apiClient';
import { Lang } from '../lib/i18n';

interface AuthPanelProps {
  lang: Lang;
  initialMode?: 'register' | 'login' | 'recover';
  contextNotice?: string;
  onAuthenticated: (user: any) => void;
  onClose?: () => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({
  lang,
  initialMode = 'register',
  contextNotice,
  onAuthenticated,
  onClose,
}) => {
  const [mode, setMode] = useState<'register' | 'login' | 'recover'>(initialMode);
  const [recoverMethod, setRecoverMethod] = useState<'pin' | 'code'>('pin');
  const [hasSuperAdmin, setHasSuperAdmin] = useState(true);

  // Registration fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [institution, setInstitution] = useState('');
  const [targetTrack, setTargetTrack] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryPin, setRecoveryPin] = useState('');
  const [claimSuperAdmin, setClaimSuperAdmin] = useState(false);

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Recovery fields
  const [recIdentifier, setRecIdentifier] = useState('');
  const [recPhone, setRecPhone] = useState('');
  const [recPin, setRecPin] = useState('');
  const [recCode, setRecCode] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recConfirmPassword, setRecConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    apiFetch('/api/auth/bootstrap-status')
      .then((res) => setHasSuperAdmin(Boolean(res.hasSuperAdmin)))
      .catch(() => setHasSuperAdmin(true));
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setError(
        lang === 'bn'
          ? 'পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মেলেনি।'
          : 'Password and confirm password do not match.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          phoneNumber,
          institution,
          targetTrack,
          password,
          recoveryPin: recoveryPin.trim() || undefined,
          claimSuperAdmin: !hasSuperAdmin && claimSuperAdmin,
        }),
      });
      setAuthToken(res.authToken);
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || (lang === 'bn' ? 'রেজিস্ট্রেশন ব্যর্থ হয়েছে' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password: loginPassword,
        }),
      });
      setAuthToken(res.authToken);
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(
        err.message ||
          (lang === 'bn'
            ? 'অ্যাকাউন্ট পাওয়া যায়নি বা পাসওয়ার্ড ভুল। আগে রেজিস্ট্রেশন করুন।'
            : 'Invalid credentials or unregistered account. Please register first.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (recNewPassword !== recConfirmPassword) {
      setError(
        lang === 'bn'
          ? 'নতুন পাসওয়ার্ড দুটি মেলেনি।'
          : 'New passwords do not match.'
      );
      return;
    }

    setLoading(true);
    try {
      if (recoverMethod === 'pin') {
        await apiFetch('/api/auth/password-recovery/reset-with-pin', {
          method: 'POST',
          body: JSON.stringify({
            identifier: recIdentifier,
            phoneNumber: recPhone,
            recoveryPin: recPin,
            newPassword: recNewPassword,
          }),
        });
      } else {
        await apiFetch('/api/auth/password-recovery/reset-with-code', {
          method: 'POST',
          body: JSON.stringify({
            identifier: recIdentifier,
            resetCode: recCode,
            newPassword: recNewPassword,
          }),
        });
      }

      setSuccessMsg(
        lang === 'bn'
          ? 'পাসওয়ার্ড সফলভাবে রিসেট হয়েছে। এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
          : 'Password reset successful. Please log in with your new password.'
      );
      setIdentifier(recIdentifier);
      setLoginPassword('');
      setRecPin('');
      setRecCode('');
      setRecNewPassword('');
      setRecConfirmPassword('');
      setMode('login');
    } catch (err: any) {
      setError(err.message || (lang === 'bn' ? 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে' : 'Password recovery failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEmailCode = async () => {
    setError('');
    setSuccessMsg('');
    if (!recIdentifier || !recIdentifier.includes('@')) {
      setError(
        lang === 'bn'
          ? 'ইমেইল কোড পাঠাতে অনুগ্রহ করে নিবন্ধিত ইমেইল লিখুন।'
          : 'Enter your registered email address first.'
      );
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/auth/password-recovery/request-code', {
        method: 'POST',
        body: JSON.stringify({ email: recIdentifier }),
      });
      setSuccessMsg(
        lang === 'bn'
          ? 'অ্যাকাউন্ট পাওয়া গেলে ইমেইলে ৬-ডিজিটের রিসেট কোড পাঠানো হয়েছে।'
          : 'If the account exists, a 6-digit recovery code was sent to your email.'
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {mode === 'register'
              ? lang === 'bn'
                ? 'নতুন অ্যাকাউন্ট রেজিস্ট্রেশন'
                : 'Create Your Account'
              : mode === 'recover'
              ? lang === 'bn'
                ? 'পাসওয়ার্ড রিকভারি'
                : 'Password Recovery'
              : lang === 'bn'
              ? 'অ্যাকাউন্ট লগইন'
              : 'Sign In to Dashboard'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {mode === 'recover'
              ? lang === 'bn'
                ? 'রিকভারি পিন অথবা অ্যাডমিন/ইমেইল কোড ব্যবহার করে পাসওয়ার্ড রিসেট করুন'
                : 'Reset your password via Recovery PIN or 6-digit Reset Code'
              : lang === 'bn'
              ? 'লগইনের আগে নাম, ইমেইল ও ফোন নম্বর দিয়ে রেজিস্ট্রেশন বাধ্যতামূলক'
              : 'Register with your name, email & phone before logging in'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Mode Switch Tabs */}
      {mode !== 'recover' && (
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 m-4 mb-0 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setSuccessMsg('');
            }}
            className={`min-h-[44px] flex items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'রেজিস্ট্রেশন' : 'Register'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccessMsg('');
            }}
            className={`min-h-[44px] flex items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{lang === 'bn' ? 'লগইন' : 'Login'}</span>
          </button>
        </div>
      )}

      <div className="p-5 space-y-4">
        {contextNotice && (
          <div className="rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 px-3.5 py-2.5 text-xs text-sky-800 dark:text-sky-300">
            {contextNotice}
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {lang === 'bn' ? 'পূর্ণ নাম *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={lang === 'bn' ? 'আপনার পূর্ণ নাম লিখুন' : 'e.g. Tariqul Islam'}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'bn' ? 'ইমেইল *' : 'Email Address *'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'bn' ? 'ফোন নম্বর *' : 'Phone Number *'}
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'bn' ? 'শিক্ষা প্রতিষ্ঠান' : 'Institution (Optional)'}
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder={lang === 'bn' ? 'কলেজ / বিশ্ববিদ্যালয়' : 'College / University'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'bn' ? 'লক্ষ্য / বিভাগ' : 'Target Track (Optional)'}
                </label>
                <input
                  type="text"
                  value={targetTrack}
                  onChange={(e) => setTargetTrack(e.target.value)}
                  placeholder="HSC / Admission / BCS"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'bn' ? 'পাসওয়ার্ড *' : 'Password *'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন *' : 'Confirm Password *'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {lang === 'bn'
                  ? 'পাসওয়ার্ড রিকভারি পিন (ভবিষ্যতে পাসওয়ার্ড ভুলে গেলে ব্যবহারের জন্য)'
                  : 'Recovery PIN (4+ chars, for future password recovery)'}
              </label>
              <input
                type="password"
                minLength={4}
                maxLength={24}
                value={recoveryPin}
                onChange={(e) => setRecoveryPin(e.target.value)}
                placeholder={lang === 'bn' ? 'যেমন: 4829 বা গোপন পিন' : 'e.g. 4829'}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>

            {!hasSuperAdmin && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={claimSuperAdmin}
                  onChange={(e) => setClaimSuperAdmin(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400"
                />
                <span className="flex-1">
                  <span className="font-semibold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    {lang === 'bn'
                      ? 'প্রাথমিক সুপার অ্যাডমিন হিসেবে রেজিস্ট্রেশন করুন'
                      : 'Register as Primary Super Admin'}
                  </span>
                  <span className="block opacity-85 mt-0.5">
                    {lang === 'bn'
                      ? 'এখনো কোনো সুপার অ্যাডমিন নেই (টেস্টিংয়ের জন্য ২এফএ বন্ধ রাখা হয়েছে)।'
                      : 'No Super Admin exists yet. Select to bootstrap the Super Admin dashboard.'}
                  </span>
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {loading
                ? lang === 'bn'
                  ? 'অ্যাকাউন্ট তৈরি হচ্ছে...'
                  : 'Creating Account...'
                : lang === 'bn'
                ? 'রেজিস্ট্রেশন সম্পন্ন করুন'
                : 'Complete Registration'}
            </button>
          </form>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {lang === 'bn' ? 'ইমেইল বা ফোন নম্বর *' : 'Email or Phone Number *'}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={lang === 'bn' ? 'name@example.com অথবা 017...' : 'Email or Phone'}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {lang === 'bn' ? 'পাসওয়ার্ড *' : 'Password *'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRecIdentifier(identifier);
                    setError('');
                    setSuccessMsg('');
                    setMode('recover');
                  }}
                  className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                >
                  {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
                </button>
              </div>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {loading
                ? lang === 'bn'
                  ? 'লগইন হচ্ছে...'
                  : 'Signing In...'
                : lang === 'bn'
                ? 'ড্যাশবোর্ডে লগইন করুন'
                : 'Login to Dashboard'}
            </button>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-600 dark:text-slate-400">
              {lang === 'bn' ? 'নতুন ব্যবহারকারী হলে ' : 'New user? '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-sky-700 dark:text-sky-400 font-semibold hover:underline"
              >
                {lang === 'bn' ? 'আগে রেজিস্ট্রেশন করুন' : 'Register first'}
              </button>
            </div>
          </form>
        )}

        {mode === 'recover' && (
          <form onSubmit={handleRecoverSubmit} className="space-y-3 text-sm">
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setRecoverMethod('pin');
                  setError('');
                }}
                className={`min-h-[40px] rounded-lg text-xs font-semibold ${
                  recoverMethod === 'pin'
                    ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang === 'bn' ? 'রিকভারি পিন' : 'Recovery PIN'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecoverMethod('code');
                  setError('');
                }}
                className={`min-h-[40px] rounded-lg text-xs font-semibold ${
                  recoverMethod === 'code'
                    ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang === 'bn' ? '৬-ডিজিট রিসেট কোড' : '6-Digit Reset Code'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {lang === 'bn' ? 'নিবন্ধিত ইমেইল বা ফোন *' : 'Registered Email or Phone *'}
              </label>
              <input
                type="text"
                required
                value={recIdentifier}
                onChange={(e) => setRecIdentifier(e.target.value)}
                placeholder="name@example.com"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            {recoverMethod === 'pin' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'নিবন্ধিত ফোন নম্বর *' : 'Phone Number *'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={recPhone}
                    onChange={(e) => setRecPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'রিকভারি পিন *' : 'Recovery PIN *'}
                  </label>
                  <input
                    type="password"
                    required
                    value={recPin}
                    onChange={(e) => setRecPin(e.target.value)}
                    placeholder="••••"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {lang === 'bn' ? '৬-ডিজিটের রিসেট কোড *' : '6-Digit Reset Code *'}
                  </label>
                  <button
                    type="button"
                    onClick={handleRequestEmailCode}
                    className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                  >
                    {lang === 'bn' ? 'ইমেইলে কোড পাঠান' : 'Send Email Code'}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={recCode}
                  onChange={(e) => setRecCode(e.target.value)}
                  placeholder="123456"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono tracking-widest"
                />
                <p className="text-[11px] text-slate-500">
                  {lang === 'bn'
                    ? 'ইমেইল OTP বা সুপার অ্যাডমিন ড্যাশবোর্ড থেকে ইস্যু করা কোড ব্যবহার করুন।'
                    : 'Enter the 6-digit code from your email or issued by Super Admin.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'bn' ? 'নতুন পাসওয়ার্ড *' : 'New Password *'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={recNewPassword}
                  onChange={(e) => setRecNewPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন *' : 'Confirm Password *'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={recConfirmPassword}
                  onChange={(e) => setRecConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white text-sm font-semibold"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {loading
                  ? lang === 'bn'
                    ? 'রিসেট হচ্ছে...'
                    : 'Resetting...'
                  : lang === 'bn'
                  ? 'নতুন পাসওয়ার্ড সেট করুন'
                  : 'Reset Password'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccessMsg('');
              }}
              className="w-full min-h-[40px] flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'লগইনে ফিরে যান' : 'Back to Login'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
