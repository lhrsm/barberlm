import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Settings2, Trash2, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IntegrationField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "password" | "url";
  required?: boolean;
  helper?: string;
}

interface ConfigurableIntegrationCardProps {
  tenantId: string;
  provider: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  accentColor: string; // e.g. "blue", "pink"
  fields: IntegrationField[];
  docsUrl?: string;
}

interface IntegrationRow {
  id: string;
  provider: string;
  credentials: Record<string, string>;
  active: boolean;
}

export function ConfigurableIntegrationCard({
  tenantId,
  provider,
  title,
  description,
  icon,
  iconBg,
  accentColor,
  fields,
  docsUrl,
}: ConfigurableIntegrationCardProps) {
  const [row, setRow] = useState<IntegrationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, provider]);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .maybeSingle();
    if (data) {
      setRow(data as IntegrationRow);
      setForm((data.credentials ?? {}) as Record<string, string>);
    }
    setLoading(false);
  }

  function openDialog() {
    setForm((row?.credentials ?? {}) as Record<string, string>);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && !form[f.key]?.trim()) {
        toast.error(`Preencha: ${f.label}`);
        return;
      }
    }
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      provider,
      credentials: form,
      active: true,
    };
    const { error } = row?.id
      ? await (supabase as any)
          .from("tenant_integrations")
          .update({ credentials: form, active: true })
          .eq("id", row.id)
      : await (supabase as any).from("tenant_integrations").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success(`${title} configurado!`);
    setOpen(false);
    void load();
  }

  async function toggleActive(checked: boolean) {
    if (!row?.id) return;
    const { error } = await (supabase as any)
      .from("tenant_integrations")
      .update({ active: checked })
      .eq("id", row.id);
    if (error) toast.error("Erro ao atualizar");
    else setRow({ ...row, active: checked });
  }

  async function disconnect() {
    if (!row?.id) return;
    if (!confirm(`Remover configuração de ${title}?`)) return;
    const { error } = await (supabase as any)
      .from("tenant_integrations")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Integração removida");
    setRow(null);
    setForm({});
  }

  const configured = !!row?.id;

  return (
    <Card className={cn(
      "flex flex-col bg-[#0b0f17] border border-zinc-800/80 text-white rounded-2xl overflow-hidden transition-all",
      `hover:border-${accentColor}-500/30`
    )}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className={cn("h-11 w-11 rounded-xl border grid place-items-center", iconBg)}>
            {icon}
          </div>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
            configured && row?.active
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : configured
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
          )}>
            {loading ? "..." : configured ? (row?.active ? "Ativo" : "Pausado") : "Pendente"}
          </span>
        </div>
        <CardTitle className="text-lg mt-4 text-white">{title}</CardTitle>
        <CardDescription className="text-zinc-400">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {configured && (
          <div className="flex items-center justify-between p-3 bg-[#05070d] border border-zinc-800/80 rounded-xl">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</p>
              <p className="text-sm text-white font-semibold mt-0.5">
                {row?.active ? "Conectado e ativo" : "Pausado"}
              </p>
            </div>
            <Switch
              checked={!!row?.active}
              onCheckedChange={toggleActive}
              className="data-[state=checked]:bg-[#f59e0b]"
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t border-zinc-800/80 pt-4 gap-2 justify-start">
        <Button
          onClick={openDialog}
          size="sm"
          className={cn(
            "h-8 px-3 text-xs rounded-lg font-bold",
            configured
              ? "bg-[#0b0f17] border border-zinc-700 text-white hover:bg-zinc-800"
              : "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
          )}
        >
          {configured ? (
            <><Settings2 size={14} className="mr-1.5" /> Configurar</>
          ) : (
            <><Plug size={14} className="mr-1.5" /> Conectar</>
          )}
        </Button>
        {configured && (
          <Button
            variant="ghost"
            onClick={disconnect}
            className="h-[38px] w-[38px] p-0 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
            title="Remover"
          >
            <Trash2 size={14} />
          </Button>
        )}
      </CardFooter>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar {title}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Insira as credenciais para ativar esta integração.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4 mt-2">
            {fields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  {f.label}{f.required && " *"}
                </Label>
                <Input
                  type={f.type ?? "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-[#f59e0b]/50"
                />
                {f.helper && <p className="text-[11px] text-zinc-500">{f.helper}</p>}
              </div>
            ))}
            {docsUrl && (
              <a
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-xs text-[#f59e0b] hover:underline"
              >
                Como obter as credenciais? →
              </a>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="h-[38px] rounded-xl text-zinc-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-[38px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold"
              >
                {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
