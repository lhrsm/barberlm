import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getTemplates } from "@/lib/communications.functions";
import { FileText, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Props {
  tenantId: string;
}

export function TemplateManager({ tenantId }: Props) {
  const { data: templates, isLoading } = useQuery({
    queryKey: ['communication-templates', tenantId],
    queryFn: () => getTemplates({ data: { tenantId } })
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <Input 
            placeholder="Buscar templates..." 
            className="pl-10 bg-[#0b0f17] border-zinc-800 rounded-xl"
          />
        </div>
        <Button className="w-full sm:w-auto bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-black rounded-xl">
          <Plus size={18} className="mr-2" /> Novo Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates?.map((template: any) => (
          <Card key={template.id} className="bg-[#0b0f17] border-zinc-800/80 hover:border-[#D4AF37]/30 transition-all">
            <CardHeader>
              <div className="flex justify-between items-start">
                <Badge variant="outline" className="bg-zinc-900/50 border-zinc-800 capitalize text-[10px]">
                  {template.channel_type}
                </Badge>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">v{template.version}</span>
              </div>
              <CardTitle className="text-lg mt-2">{template.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-[#05070d] rounded-lg p-3 border border-zinc-800/50 mb-4 h-32 overflow-y-auto">
                <p className="text-xs text-zinc-400 font-mono whitespace-pre-wrap">{template.content}</p>
              </div>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-zinc-800/50">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">{template.key}</span>
                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest hover:text-[#D4AF37]">
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!templates?.length && !isLoading && (
          <div className="col-span-full py-12 text-center text-zinc-500">
            Nenhum template cadastrado para este canal.
          </div>
        )}
      </div>
    </div>
  );
}
