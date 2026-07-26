import * as React from "react";
import { ChevronsUpDown, Search, Check, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityAvatar } from "./EntityAvatar";
import { resolveImageUrl } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  barbers: any[];
  value: string;
  onChange: (id: string) => void;
  error?: string | null;
}

export function ProfessionalSelector({ barbers, value, onChange, error }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = barbers.find((b) => b.id === value);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return barbers;
    return barbers.filter((b) => (b.name || "").toLowerCase().includes(q));
  }, [barbers, query]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Profissional
      </label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Selecionar profissional"
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              error ? "border-destructive" : "border-border",
            )}
          >
            {selected ? (
              <>
                <EntityAvatar
                  imageUrl={resolveImageUrl(selected)}
                  name={selected.name}
                  entityType="professional"
                  size={44}
                  showStatus
                  active={selected.active !== false}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {selected.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {selected.category || "Barbeiro"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                  <Pencil className="h-3.5 w-3.5" /> Alterar
                </span>
              </>
            ) : (
              <>
                <EntityAvatar name="" entityType="professional" size={44} />
                <span className="flex-1 text-sm text-muted-foreground">
                  Selecione o profissional
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-0"
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar profissional"
              aria-label="Buscar profissional"
              className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {list.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum profissional encontrado.
              </p>
            )}
            {list.map((b) => {
              const isActive = b.active !== false;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onChange(b.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <EntityAvatar
                    imageUrl={resolveImageUrl(b)}
                    name={b.name}
                    entityType="professional"
                    size={40}
                    showStatus
                    active={isActive}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {b.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {b.category || "Barbeiro"}
                      {Array.isArray(b.specialties) && b.specialties.length > 0
                        ? ` · ${b.specialties.slice(0, 3).join(", ")}`
                        : ""}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 inline-block text-[11px] font-semibold",
                        isActive ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    >
                      {isActive ? "Disponível" : "Inativo"}
                    </span>
                  </span>
                  {value === b.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
