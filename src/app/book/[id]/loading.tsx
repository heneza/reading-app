export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="flex gap-6">
        <div className="h-[210px] w-[140px] flex-shrink-0 rounded bg-stone-200" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-2/3 rounded bg-stone-200" />
          <div className="h-4 w-1/3 rounded bg-stone-200" />
          <div className="mt-4 h-20 w-full rounded bg-stone-100" />
          <div className="h-8 w-40 rounded bg-stone-100" />
        </div>
      </div>
      <div className="mt-8 h-32 w-full rounded-lg bg-stone-100" />
    </div>
  );
}
