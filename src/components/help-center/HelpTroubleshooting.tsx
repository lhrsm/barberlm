import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

interface TroubleshootingItem {
  symptom: string;
  causes: string[];
  solution: string;
}

interface HelpTroubleshootingProps {
  items: TroubleshootingItem[];
}

export function HelpTroubleshooting({ items }: HelpTroubleshootingProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map((item, idx) => (
        <Card key={idx} className="bg-[#0b0f17] border-zinc-800 border-l-4 border-l-amber-500">
          <CardHeader className="p-6 pb-2">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-500 h-5 w-5" />
              {item.symptom}
            </h4>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Possíveis Causas</p>
              <ul className="text-sm text-zinc-400 list-disc list-inside">
                {item.causes.map((cause, cIdx) => <li key={cIdx}>{cause}</li>)}
              </ul>
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 size={12} /> Solução Sugerida
              </p>
              <p className="text-sm text-zinc-300">{item.solution}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
