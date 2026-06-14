'use client';

import { deleteAccount } from '@/app/actions/account';

export default function DeleteAccount() {
  return (
    <form
      action={deleteAccount}
      onSubmit={(e) => {
        if (!window.confirm('Permanently delete your account and ALL your data? This cannot be undone.')) {
          e.preventDefault();
        }
      }}
    >
      <button className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
        Delete my account
      </button>
    </form>
  );
}
