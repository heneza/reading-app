'use client';

import { useState } from 'react';
import { setPassword } from '@/app/actions/account';

// Lets the signed-in user set/change a password. Especially useful for
// accounts created with Google sign-in (which have no password), so they can
// also log in with their username/email afterwards.
export default function SetPasswordForm() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function action(formData: FormData) {
    setPending(true);
    setMsg(null);
    const res = await setPassword(formData);
    setPending(false);
    if (res.error) {
      setMsg({ ok: false, text: res.error });
    } else {
      setMsg({
        ok: true,
        text: 'Password set. You can now log in with your username or email and this password.',
      });
    }
  }

  const inputCls =
    'w-full rounded border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-800';

  return (
    <form action={action} className="space-y-2 border-t border-stone-100 pt-3">
      <p>
        Set a password to log in with your username or email. Handy if you
        signed up with Google and want a password too.
      </p>
      <input
        type="password"
        name="password"
        autoComplete="new-password"
        placeholder="New password (at least 8 characters)"
        className={inputCls}
      />
      <input
        type="password"
        name="confirm"
        autoComplete="new-password"
        placeholder="Confirm new password"
        className={inputCls}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Set password'}
      </button>
      {msg && (
        <p className={msg.ok ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
