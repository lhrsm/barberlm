import { Crown, ExternalLink } from "lucide-react";
import { CustomerSelector } from "./CustomerSelector";
import { EntityAvatar } from "./EntityAvatar";
import { resolveImageUrl, formatBRL } from "./appointment-utils";
import { Button } from "@/components/ui/button";

interface Props {
  customers: any[];
  selectedCustomer: string;
  onCustomerChange: (id: string) => void;
  onCreateNew: () => void;
  errors: Record<string, string | null>;
}

export function CustomerStep({
  customers,
  selectedCustomer,
  onCustomerChange,
  onCreateNew,
  errors,
}: Props) {
  const customer = customers.find((c) => c.id === selectedCustomer);

  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-4 duration-300">
      <CustomerSelector
        customers={customers}
        value={selectedCustomer}
        onChange={onCustomerChange}
        onCreateNew={onCreateNew}
        error={errors.customer}
      />

      {customer && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <EntityAvatar
              imageUrl={resolveImageUrl(customer)}
              name={customer.name}
              entityType="customer"
              size={60}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-black text-foreground">{customer.name}</h3>
                {customer.is_subscriber && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                    <Crown className="h-3 w-3" /> Assinante
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{customer.phone || "Sem telefone"}</p>
              {customer.email && (
                <p className="truncate text-sm text-muted-foreground">{customer.email}</p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Créditos disponíveis
                  </p>
                  <p className="text-sm font-black text-foreground">
                    {formatBRL(Number(customer.credits ?? customer.credit_balance ?? 0))}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Cashback disponível
                  </p>
                  <p className="text-sm font-black text-foreground">
                    {formatBRL(Number(customer.cashback_balance || 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCustomerChange("")}
              className="h-8 rounded-lg text-xs font-semibold"
            >
              Alterar cliente
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              asChild
              className="h-8 rounded-lg text-xs font-semibold"
            >
              <a href="/customers" target="_blank" rel="noreferrer">
                Visualizar perfil <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
