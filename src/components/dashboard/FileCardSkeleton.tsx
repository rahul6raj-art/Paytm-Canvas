export function FileCardSkeleton() {
  return (
    <div className="editor-sidebar-section flex flex-col overflow-hidden shadow-none">
      <div className="aspect-[16/10] w-full animate-pulse bg-app-inset" />
      <div className="space-y-2.5 p-3.5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-app-inset" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-app-raised" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-6 w-6 animate-pulse rounded-full bg-app-inset" />
          <div className="h-3 w-16 animate-pulse rounded bg-app-raised" />
        </div>
      </div>
    </div>
  );
}
