export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-8 w-32 rounded bg-stone-200" />
      <div className="h-10 w-full rounded-full bg-stone-100" />
      <ul className="mt-6 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => <li key={i} className="h-[88px] w-full rounded border border-slate-200 bg-stone-100" />)}
      </ul>
    </div>
  );
}
