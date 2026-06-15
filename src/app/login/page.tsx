import Link from 'next/link';
import Script from 'next/script';
import { login, signup, signInWithGoogle } from './actions';
import PendingButton from '@/components/PendingButton';

const inputCls = 'w-full rounded border border-slate-300 px-3 py-2';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string; mode?: string };
}) {
  const isSignup = searchParams.mode === 'signup';
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <div className="mx-auto max-w-sm">
      {turnstileSiteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      )}
      <h1 className="mb-1 text-2xl font-bold">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {isSignup ? 'Join Reading App and start your shelf.' : 'Log in to your shelf.'}
      </p>

      {searchParams.error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.message && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">{searchParams.message}</p>
      )}

      <form action={signInWithGoogle}>
        <PendingButton
          pendingLabel="Opening Google..."
          className="flex w-full items-center justify-center gap-2 rounded border border-slate-300 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.8 6.3 14.7z"/><path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.1 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.2 5.2C39.9 36.4 43.5 30.8 43.5 24c0-1.2-.1-2.3-.3-3.5z"/></svg>
          Continue with Google
        </PendingButton>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or use email
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {isSignup ? (
        <form action={signup} className="space-y-3">
          <div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
              <input name="username" required autoCapitalize="none" autoCorrect="off" placeholder="username" className="w-full rounded border border-slate-300 py-2 pl-7 pr-3" />
            </div>
            <p className="mt-1 text-xs text-slate-400">3–20 characters · letters, numbers, periods, underscores.</p>
          </div>
          <input name="email" type="email" required placeholder="you@example.com" className={inputCls} />
          <input name="password" type="password" required minLength={6} placeholder="Password (min 6 chars)" className={inputCls} />
          <label className="block text-xs text-slate-500">
            Date of birth
            <input name="dob" type="date" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs text-slate-500">
            Gender
            <select name="gender" defaultValue="prefer-not-to-say" className={`mt-1 ${inputCls}`}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </label>
          {turnstileSiteKey && (
            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
          )}
          <PendingButton pendingLabel="Creating account..." className="w-full rounded bg-brand py-2 font-medium text-white hover:opacity-90">
            Create account
          </PendingButton>
          <p className="pt-1 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link>
          </p>
        </form>
      ) : (
        <form action={login} className="space-y-3">
          <input name="identifier" type="text" required autoCapitalize="none" autoCorrect="off" placeholder="Email or username" className={inputCls} />
          <input name="password" type="password" required placeholder="Password" className={inputCls} />
          {turnstileSiteKey && (
            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
          )}
          <PendingButton pendingLabel="Logging in..." className="w-full rounded bg-brand py-2 font-medium text-white hover:opacity-90">
            Log in
          </PendingButton>
          <p className="pt-1 text-center text-sm text-slate-500">
            New here?{' '}
            <Link href="/login?mode=signup" className="font-medium text-brand hover:underline">Create an account</Link>
          </p>
        </form>
      )}
    </div>
  );
}
