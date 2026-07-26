import * as React from "react";
import { ChevronsUpDown, Search, Check, UserPlus, Crown, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityAvatar } from "./EntityAvatar";
import { resolveImageUrl, formatBRL } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  customers: any[];
  value: string;
  onChange: (id: string) => void;
  onCreateNew: () => void;
  error?: string | null;
}

export function CustomerSelector({ customers, value, onChange, onCreateNew, error }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = customers.find((c) => c.id === value);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 60);
    return customers
      .filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [customers, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Cliente
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCreateNew}
          className="h-8 gap-1.5 rounded-lg text-xs font-semibold"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Novo cliente
        </Button>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Buscar e selecionar cliente"
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              error ? "border-destructive" : "border-border",
            )}
          >
            <EntityAvatar
              imageUrl={selected ? resolveImageUrl(selected) : null}
              name={selected?.name}
              entityType="customer"
              size={44}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                {selected?.name || "Buscar por nome, telefone ou e-mail"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {selected?.phone || "Nenhum cliente selecionado"}
              </span>
            </span>
            {selected ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                <Pencil className="h-3.5 w-3.5" /> Alterar
              </span>
            ) : (
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              aria-label="Buscar cliente"
              className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {list.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            )}
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <EntityAvatar
                  imageUrl={resolveImageUrl(c)}
                  name={c.name}
                  entityType="customer"
                  size={40}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                    {c.is_subscriber && (
                      <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Assinante" />
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.phone || c.email || "Sem contato"}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    Créditos: {formatBRL(Number(c.credits ?? c.credit_balance ?? 0))} · Cashback:{" "}
                    {formatBRL(Number(c.cashback_balance || 0))}
                  </span>
                </span>
                {value === c.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
