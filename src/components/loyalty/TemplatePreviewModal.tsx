import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as LucideIcons from "lucide-react";

export function TemplatePreviewModal({
  template,
  open,
  onOpenChange,
  onUse,
}: {
  template: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUse: () => void;
}) {
  if (!template) return null;
  const IconComp = (LucideIcons as any)[template.icon || "Gift"] || LucideIcons.Gift;
  const color = template.color || "#f59e0b";
  const benefits: string[] = Array.isArray(template.benefits) ? template.benefits : [];
  const config = template.default_config || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-[#0b0f17] border-zinc-800 text-white">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-xl grid place-items-center border"
              style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)`, borderColor: `${color}55` }}
            >
              <IconComp className="h-6 w-6" style={{ color }} />
            </div>
            <div>
              <DialogTitle className="text-xl">{template.name}</DialogTitle>
              <DialogDescription className="text-zinc-400">{template.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 capitalize">{template.category}</Badge>
            <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 capitalize">{template.difficulty}</Badge>
            <Badge variant="outline" className="border-[#f59e0b]/40 text-[#f59e0b]">{config.rule_type}</Badge>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-2">Benefícios</h4>
            <ul className="space-y-1.5 text-sm text-zinc-300">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-2">Configuração padrão</h4>
            <pre className="bg-[#05070d] border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 overflow-x-auto">
{JSON.stringify(config, null, 2)}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400">
            Fechar
          </Button>
          <Button
            onClick={onUse}
            className="bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-black font-bold"
          >
            Usar este modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
