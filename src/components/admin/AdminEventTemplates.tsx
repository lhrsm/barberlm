import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface CatalogItem {
  event_key: string;
  category: string;
  label: string;
  description: string;
  default_severity: string;
}

interface TemplateRow {
  event_key: string;
  title_tpl: string;
  message_tpl: string;
}

export function AdminEventTemplates() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { title_tpl: string; message_tpl: string }>>({});

  const { data: catalog } = useQuery({
    queryKey: ["admin-event-catalog-tpl"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_admin_event_catalog");
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["admin-event-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_event_templates").select("*");
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  useEffect(() => {
    if (!templates) return;
    const map: Record<string, { title_tpl: string; message_tpl: string }> = {};
    templates.forEach((t) => (map[t.event_key] = { title_tpl: t.title_tpl, message_tpl: t.message_tpl }));
    setDrafts(map);
  }, [templates]);

  const save = async (event_key: string) => {
    const d = drafts[event_key];
    if (!d) return;
    const { error } = await supabase
      .from("admin_event_templates")
      .upsert({ event_key, title_tpl: d.title_tpl, message_tpl: d.message_tpl, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Template salvo");
    queryClient.invalidateQueries({ queryKey: ["admin-event-templates"] });
  };

  const reset = (event_key: string) => {
    const orig = templates?.find((t) => t.event_key === event_key);
    if (!orig) return;
    setDrafts((s) => ({ ...s, [event_key]: { title_tpl: orig.title_tpl, message_tpl: orig.message_tpl } }));
  };

  if (!catalog) return null;

  return (
    <Card className="border-amber-500/20 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileText className="h-5 w-5 text-amber-400" /> Templates de Notificações Admin
        </CardTitle>
        <CardDescription>
          Personalize o título e a mensagem enviados para cada evento. Use variáveis entre chaves duplas —{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{{business_name}}"}</code>,{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{{amount}}"}</code>, etc — que serão substituídas
          automaticamente pelos dados do evento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {catalog.map((item) => {
          const d = drafts[item.event_key] ?? { title_tpl: "", message_tpl: "" };
          const orig = templates?.find((t) => t.event_key === item.event_key);
          const dirty = orig && (orig.title_tpl !== d.title_tpl || orig.message_tpl !== d.message_tpl);
          return (
            <div
              key={item.event_key}
              className="rounded-lg border border-border/50 bg-background/40 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{item.label}</span>
                    <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                    <code className="text-[10px] text-muted-foreground">{item.event_key}</code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {dirty && (
                    <Button size="sm" variant="ghost" onClick={() => reset(item.event_key)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => save(item.event_key)}
                    disabled={!dirty}
                    className="bg-amber-500 hover:bg-amber-600 text-black"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Título com {{variaveis}}"
                value={d.title_tpl}
                onChange={(e) =>
                  setDrafts((s) => ({ ...s, [item.event_key]: { ...d, title_tpl: e.target.value } }))
                }
                className="bg-background/50"
              />
              <Textarea
                placeholder="Mensagem com {{variaveis}}"
                value={d.message_tpl}
                rows={2}
                onChange={(e) =>
                  setDrafts((s) => ({ ...s, [item.event_key]: { ...d, message_tpl: e.target.value } }))
                }
                className="bg-background/50 resize-none"
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
