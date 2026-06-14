export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-start gap-5">
        <div className="h-[72px] w-[72px] flex-shrink-0 rounded-full bg-stone-200" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-40 rounded bg-stone-200" />
          <div className="h-4 w-28 rounded bg-stone-200" />
          <div className="h-4 w-64 rounded bg-stone-100" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-4 gap-3" style={{ maxWidth: '28rem' }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[2/3] rounded bg-stone-100" />)}
      </div>
    </div>
  );
}
