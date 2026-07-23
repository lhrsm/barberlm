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
        "flex items-center gap-3 rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-r from-[#D4AF37]/10 via-[#0b0f17] to-[#0b0f17] px-4 py-3 shadow-[0_4px_16px_rgba(212,175,55,0.10)]",
        className,
      )}
      role="status"
    >
      <div className="h-9 w-9 shrink-0 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 grid place-items-center">
        <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-widest text-[#D4AF37]">
          Ambiente interno de testes
        </p>
        <p className="text-[13px] text-zinc-300 leading-snug">
          Esta barbearia utiliza um voucher administrativo permanente concedido pelo Super Admin.
        </p>
      </div>
    </div>
  );
}
