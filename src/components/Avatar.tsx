// A small round avatar. Shows the uploaded photo when present, otherwise a
// coloured circle with the user's initial. Works in server or client
// components (no hooks, no browser APIs).

const COLORS = [
  '#8a1730', '#1f6f6b', '#3a6fc4', '#9a6a1f',
  '#5b3a8a', '#7a1f4f', '#2f7a3a', '#b04a2f',
];

function colorFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export default function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  const label = (name ?? '').trim();
  const initial = (label[0] ?? '?').toUpperCase();
  const dim = { width: `${size}px`, height: `${size}px` };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label || 'avatar'}
        style={dim}
        className="flex-shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ ...dim, backgroundColor: colorFor(label || '?'), fontSize: size * 0.42 }}
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
    >
      {initial}
    </span>
  );
}
