import Link from 'next/link';
import { requestPasswordReset } from '@/app/login/actions';
import Turnstile from '@/components/Turnstile';

const inputCls = 'w-full rounded border border-slate-300 px-3 py-2';

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 text-sm text-slate-500">
        Enter your account email and we will send a secure reset link.
      </p>

      {searchParams.error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.message && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">{searchParams.message}</p>
      )}

      <form action={requestPasswordReset} className="space-y-3">
        <input type="hidden" name="next" value="/reset-password" />
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputCls}
        />
        {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} />}
        <button className="w-full rounded bg-brand py-2 font-medium text-white hover:opacity-90">
          Send reset link
        </button>
      </form>

      <p className="pt-4 text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
