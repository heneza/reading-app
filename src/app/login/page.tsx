import { login, signup } from './actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Welcome</h1>
      <p className="mb-6 text-sm text-slate-500">
        Log in, or create an account to start your shelf.
      </p>

      {searchParams.error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </p>
      )}
      {searchParams.message && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">
          {searchParams.message}
        </p>
      )}

      <form className="space-y-3">
        <input
          name="identifier"
          type="text"
          required
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="Email or username"
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Password (min 6 chars)"
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
        <div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              @
            </span>
            <input
              name="username"
              placeholder="username (to sign up)"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded border border-slate-300 py-2 pl-7 pr-3"
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            3–20 characters · letters, numbers, periods, underscores. To sign up, put your email above and pick a username here.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            formAction={login}
            className="flex-1 rounded bg-brand py-2 font-medium text-white hover:opacity-90"
          >
            Log in
          </button>
          <button
            formAction={signup}
            className="flex-1 rounded border border-brand py-2 font-medium text-brand hover:bg-brand-soft"
          >
            Sign up
          </button>
        </div>
      </form>
    </div>
  );
}
