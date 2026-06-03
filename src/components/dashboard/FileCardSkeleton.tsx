export function FileCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-app-border/90 bg-app-card shadow-sm">
      <div className="aspect-[16/10] w-full animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200" />
      <div className="space-y-2.5 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-app-inset" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-6 w-6 animate-pulse rounded-full bg-slate-200" />
          <div className="h-3 w-16 animate-pulse rounded bg-app-inset" />
        </div>
      </div>
    </div>
  );
}
