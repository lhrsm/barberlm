import * as React from "react";
import { ChevronsUpDown, Search, Check, Scissors, Clock, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { formatBRL } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  services: any[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  error?: string | null;
  warning?: string | null;
}

export function ServiceSelector({ services, value, onChange, disabled, error, warning }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = services.find((s) => s.id === value);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.category || "").toLowerCase().includes(q),
    );
  }, [services, query]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Serviço
      </label>

      <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Selecionar serviço"
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
              error ? "border-destructive" : "border-border",
            )}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Scissors className="h-5 w-5" />
            </span>
            {selected ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {selected.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {selected.duration_minutes} min · {formatBRL(Number(selected.price || 0))}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                  <Pencil className="h-3.5 w-3.5" /> Alterar
                </span>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-muted-foreground">
                  {services.length > 0
                    ? "Selecione o serviço"
                    : "Nenhum serviço vinculado a este profissional"}
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar serviço"
              aria-label="Buscar serviço"
              className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {list.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum serviço encontrado.
              </p>
            )}
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {s.name}
                  </span>
                  {s.category && (
                    <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-primary">
                      {s.category}
                    </span>
                  )}
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {s.duration_minutes} min
                  </span>
                  {s.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {s.description}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-bold text-foreground">
                  {formatBRL(Number(s.price || 0))}
                </span>
                {value === s.id && <Check className="ml-1 h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {warning && <p className="text-xs font-medium text-amber-600">{warning}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
