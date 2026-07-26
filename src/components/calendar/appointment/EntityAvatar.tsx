import * as React from "react";
import { cn } from "@/lib/utils";

export type EntityType = "professional" | "customer" | "service";

interface EntityAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  entityType?: EntityType;
  size?: number;
  showStatus?: boolean;
  active?: boolean;
  className?: string;
}

function initialsOf(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function EntityAvatar({
  imageUrl,
  name,
  entityType = "customer",
  size = 40,
  showStatus = false,
  active = true,
  className,
}: EntityAvatarProps) {
  const [errored, setErrored] = React.useState(false);
  React.useEffect(() => setErrored(false), [imageUrl]);

  const showImage = !!imageUrl && !errored;
  const fontSize = Math.max(10, Math.round(size * 0.36));

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={imageUrl as string}
          alt={`Foto de ${name || "usuário"}`}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full rounded-full object-cover object-center ring-1 ring-border"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          aria-label={`Foto de ${name || "usuário"}`}
          role="img"
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full font-bold uppercase ring-1 ring-border",
            entityType === "professional"
              ? "bg-primary/12 text-primary"
              : "bg-muted text-muted-foreground",
          )}
          style={{ fontSize }}
        >
          {initialsOf(name)}
        </span>
      )}
      {showStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-background",
            active ? "bg-emerald-500" : "bg-muted-foreground/50",
          )}
          style={{ width: Math.max(8, size * 0.24), height: Math.max(8, size * 0.24) }}
          aria-hidden
        />
      )}
    </span>
  );
}
