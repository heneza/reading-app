export default function TasteMatchBadge({
  text,
  title,
}: {
  text: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex flex-shrink-0 items-center rounded-full border border-brand/20 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand"
    >
      {text}
    </span>
  );
}
