'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { createClient } from '@/utils/supabase/client';
import { setAvatar } from '@/app/actions/profile';

const VIEW = 240; // editor viewport (px)
const OUT = 256; // exported image size (px)

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
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const router = useRouter();

  const baseScale = nat.w && nat.h ? VIEW / Math.min(nat.w, nat.h) : 1;
  const eff = baseScale * zoom;
  const imgW = nat.w * eff;
  const imgH = nat.h * eff;

  function clampAt(x: number, y: number, w: number, h: number) {
    return {
      x: Math.min(0, Math.max(VIEW - w, x)),
      y: Math.min(0, Math.max(VIEW - h, y)),
    };
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
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
    setImgSrc(URL.createObjectURL(file));
    setZoom(1);
    setEditing(true);
  }

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const im = e.currentTarget;
    const w = im.naturalWidth;
    const h = im.naturalHeight;
    setNat({ w, h });
    const bs = VIEW / Math.min(w, h);
    setOffset({ x: (VIEW - w * bs) / 2, y: (VIEW - h * bs) / 2 });
  }

  function onZoom(e: React.ChangeEvent<HTMLInputElement>) {
    const z = Number(e.target.value);
    const e2 = baseScale * z;
    const w = nat.w * e2;
    const h = nat.h * e2;
    // keep the viewport centre stable while zooming
    const cx = VIEW / 2;
    const cy = VIEW / 2;
    const ratio = e2 / eff;
    const nx = cx - (cx - offset.x) * ratio;
    const ny = cy - (cy - offset.y) * ratio;
    setZoom(z);
    setOffset(clampAt(nx, ny, w, h));
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    setOffset(clampAt(drag.current.ox + dx, drag.current.oy + dy, imgW, imgH));
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function save() {
    if (!imgRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d')!;
      const srcSize = VIEW / eff;
      const srcX = -offset.x / eff;
      const srcY = -offset.y / eff;
      ctx.drawImage(imgRef.current, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);
      const blob: Blob = await new Promise((res) =>
        canvas.toBlob((b) => res(b as Blob), 'image/jpeg', 0.9)
      );

      const supabase = createClient();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
      if (upErr) {
        setError(upErr.message);
        setBusy(false);
        return;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const res = await setAvatar(data.publicUrl);
      if (res.error) {
        setError(res.error);
        setBusy(false);
        return;
      }
      setUrl(data.publicUrl);
      setEditing(false);
      setImgSrc(null);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setEditing(false);
    setImgSrc(null);
    setError(null);
  }

  async function remove() {
    setBusy(true);
    const res = await setAvatar('');
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setUrl(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar src={url} name={name} size={64} />
        <div>
          <label className="inline-block cursor-pointer rounded bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">
            {editing ? 'Choose another' : 'Change photo'}
            <input type="file" accept="image/*" onChange={onFile} className="hidden" />
          </label>
          {url && !editing && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="ml-3 text-sm text-stone-500 hover:text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {editing && imgSrc && (
        <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
          <p className="mb-2 text-sm text-stone-500">
            Drag to reposition · slide to zoom
          </p>
          <div
            className="relative mx-auto touch-none overflow-hidden rounded-full bg-stone-100"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: 'absolute',
                left: offset.x,
                top: offset.y,
                width: imgW || undefined,
                height: imgH || undefined,
                maxWidth: 'none',
                userSelect: 'none',
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/70" />
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={onZoom}
            className="mt-3 w-full accent-brand"
            style={{ maxWidth: VIEW }}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="rounded border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save photo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
