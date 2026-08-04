import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HelpSearchProps {
  value: string;
  onChange: (val: string) => void;
}

export function HelpSearch({ value, onChange }: HelpSearchProps) {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 h-5 w-5" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="O que você está procurando? (Ex: Configurar agenda, Comissões...)"
        className="pl-12 h-14 rounded-2xl bg-[#0b0f17] border-zinc-800 text-lg focus-visible:border-gold/50 focus-visible:ring-gold/20 shadow-xl"
      />
    </div>
  );
}
