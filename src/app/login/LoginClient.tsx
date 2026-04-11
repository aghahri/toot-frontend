'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, requestOtp, verifyOtp } from '@/lib/auth';
import { DevOtpToast } from '@/components/DevOtpToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/forms/TextInput';

type AuthMode = 'password' | 'otp';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/home';

  const [mode, setMode] = useState<AuthMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneMask, setPhoneMask] = useState<string | null>(null);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [devOtpToastEpoch, setDevOtpToastEpoch] = useState(0);
  const [otpRequested, setOtpRequested] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const redirectTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  function resetOtpFlow() {
    setOtpRequested(false);
    setOtpCode('');
    setPhoneMask(null);
    setDevOtpCode(null);
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await login(email.trim(), password);
      setSuccess('ورود با موفقیت انجام شد');
      redirectTimer.current = window.setTimeout(() => {
        router.replace(next);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ورود');
    } finally {
      setLoading(false);
    }
  }

  async function onRequestOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await requestOtp(phone.trim());
      setPhoneMask(res.phoneMask);
      const otp =
        res.devOtpCode != null && String(res.devOtpCode).trim() !== ''
          ? String(res.devOtpCode).trim()
          : null;
      setDevOtpCode(otp);
      setDevOtpToastEpoch((e) => e + 1);
      setOtpRequested(true);
      setSuccess('کد یکبار مصرف ارسال شد.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ارسال کد');
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await verifyOtp(phone.trim(), otpCode.trim());
      setSuccess('ورود با موفقیت انجام شد');
      redirectTimer.current = window.setTimeout(() => {
        router.replace(next);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'کد نامعتبر است');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* key remounts toast per OTP request so internal state cannot stick hidden from a prior cycle */}
      <DevOtpToast key={devOtpToastEpoch} code={devOtpCode} />

      <main className="mx-auto w-full max-w-md p-4">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">ورود</h1>
        <p className="mt-1 text-sm text-slate-700">برای شروع وارد حساب خود شوید.</p>
      </div>

      <div className="mb-4 flex gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
            mode === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
          onClick={() => {
            setMode('password');
            resetOtpFlow();
            setError(null);
          }}
        >
          ایمیل و رمز
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
            mode === 'otp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
          onClick={() => {
            setMode('otp');
            setError(null);
          }}
        >
          کد یکبار مصرف
        </button>
      </div>

      <Card>
        {mode === 'password' ? (
          <form onSubmit={onPasswordSubmit} className="space-y-4">
            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {success}
              </div>
            ) : null}
            <TextInput
              label="ایمیل"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
            <TextInput
              label="رمز عبور"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />

            {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}

            <Button type="submit" loading={loading}>
              {loading ? 'در حال ورود...' : 'ورود'}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-600">
              شمارهٔ موبایل ثبت‌شده را وارد کنید. کد فقط در حالت توسعه روی صفحه نمایش داده می‌شود؛ در
              محیط واقعی از طریق پیامک یا ایمیل ارسال خواهد شد.
            </p>

            {!otpRequested ? (
              <form onSubmit={onRequestOtp} className="space-y-4">
                <TextInput
                  label="موبایل"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  required
                  dir="ltr"
                />
                {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}
                <Button type="submit" loading={loading}>
                  {loading ? 'در حال ارسال...' : 'دریافت کد'}
                </Button>
              </form>
            ) : (
              <form onSubmit={onVerifyOtp} className="space-y-4">
                {success ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    {success}
                  </div>
                ) : null}

                {phoneMask ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm" dir="ltr">
                    <span className="text-slate-500">ارسال به </span>
                    <span className="font-mono font-semibold tracking-wide text-slate-800">
                      {phoneMask}
                    </span>
                  </div>
                ) : null}

                <TextInput
                  label="کد تأیید"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  disabled={loading}
                  required
                  dir="ltr"
                />

                {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" loading={loading}>
                    {loading ? 'در حال ورود...' : 'تأیید و ورود'}
                  </Button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      resetOtpFlow();
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    شمارهٔ دیگر
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="mt-4 text-center text-sm text-slate-700">
          حساب ندارید؟{' '}
          <a className="font-semibold text-slate-900" href="/register">
            ثبت‌نام
          </a>
        </div>
      </Card>
    </main>
    </>
  );
}
