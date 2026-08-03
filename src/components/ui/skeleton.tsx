import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-2xl bg-surface-raised/40 border border-hairline/10", className)} {...props} />;
}

export { Skeleton };
