import { Skeleton } from "@/components/ui/skeleton";

export function HelpSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-48 w-full rounded-2xl bg-zinc-800/50" />
          <Skeleton className="h-4 w-3/4 bg-zinc-800/50" />
          <Skeleton className="h-4 w-1/2 bg-zinc-800/50" />
        </div>
      ))}
    </div>
  );
}
