import { redirect } from 'next/navigation';
import { updatePassword } from '@/app/login/actions';
import ClearPasswordFields from '@/components/ClearPasswordFields';
import { createClient } from '@/utils/supabase/server';

const inputCls = 'w-full rounded border border-slate-300 px-3 py-2';

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/reset-password?error=' + encodeURIComponent('Open the latest reset link from your email.'));
  }

  return (
    <div className="mx-auto max-w-sm">
      <ClearPasswordFields active={Boolean(searchParams.error)} />
      <h1 className="mb-1 text-2xl font-bold">Choose a new password</h1>
      <p className="mb-6 text-sm text-slate-500">
        Set a fresh password for your Reading App account.
      </p>

      {searchParams.error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      <form action={updatePassword} className="space-y-3">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password"
          className={inputCls}
        />
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Confirm new password"
          className={inputCls}
        />
        <p className="text-xs text-slate-400">Use at least 8 characters. Longer is better.</p>
        <button className="w-full rounded bg-brand py-2 font-medium text-white hover:opacity-90">
          Update password
        </button>
      </form>
    </div>
  );
}
