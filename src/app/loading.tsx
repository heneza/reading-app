export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 w-40 rounded bg-stone-200" />
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-[138px] w-[92px] flex-shrink-0 rounded bg-stone-100" />)}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 w-full rounded-lg bg-stone-100" />)}
      </div>
    </div>
  );
}
