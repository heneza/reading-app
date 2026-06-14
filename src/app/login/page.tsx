import Link from 'next/link';
import { login, signup } from './actions';

const inputCls = 'w-full rounded border border-slate-300 px-3 py-2';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string; mode?: string };
}) {
  const isSignup = searchParams.mode === 'signup';

  return (
    <div className="mx-auto max-w-sm">
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

      {isSignup ? (
        <form className="space-y-3">
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
          <button formAction={signup} className="w-full rounded bg-brand py-2 font-medium text-white hover:opacity-90">
            Create account
          </button>
          <p className="pt-1 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link>
          </p>
        </form>
      ) : (
        <form className="space-y-3">
          <input name="identifier" type="text" required autoCapitalize="none" autoCorrect="off" placeholder="Email or username" className={inputCls} />
          <input name="password" type="password" required placeholder="Password" className={inputCls} />
          <button formAction={login} className="w-full rounded bg-brand py-2 font-medium text-white hover:opacity-90">
            Log in
          </button>
          <p className="pt-1 text-center text-sm text-slate-500">
            New here?{' '}
            <Link href="/login?mode=signup" className="font-medium text-brand hover:underline">Create an account</Link>
          </p>
        </form>
      )}
    </div>
  );
}
