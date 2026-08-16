import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * Aviso discreto exibido no topo do painel da barbearia interna beneficiária
 * de voucher administrativo permanente. Não aparece para tenants comuns.
 */
export function InternalTestingBanner({ className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-gold/20 bg-gold/5 px-3 py-2 shadow-sm backdrop-blur-sm",
        className,
      )}
      role="status"
    >
      <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-widest text-gold leading-none">
          Ambiente interno de testes
        </p>
        <p className="text-[10px] text-zinc-400 mt-0.5 leading-none">
          Voucher administrativo permanente ativo.
        </p>
      </div>
    </div>
  );
}
