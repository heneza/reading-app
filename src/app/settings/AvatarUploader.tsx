'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { createClient } from '@/utils/supabase/client';
import { setAvatar } from '@/app/actions/profile';

export default function AvatarUploader({
  userId,
  currentUrl,
  name,
}: {
  userId: string;
  currentUrl: string | null;
  name: string;
}) {
  const [url, setUrl] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const res = await setAvatar(data.publicUrl);
      if (res.error) {
        setError(res.error);
        return;
      }
      setUrl(data.publicUrl);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    startTransition(async () => {
      const res = await setAvatar('');
      if (res.error) {
        setError(res.error);
        return;
      }
      setUrl(null);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar src={url} name={name} size={64} />
      <div>
        <label className="inline-block cursor-pointer rounded bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">
          {busy ? 'Uploading…' : 'Upload photo'}
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            disabled={busy}
            className="hidden"
          />
        </label>
        {url && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ml-3 text-sm text-stone-500 hover:text-red-600 disabled:opacity-50"
          >
            Remove
          </button>
        )}
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
