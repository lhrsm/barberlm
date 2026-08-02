import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save } from "lucide-react";

type BeforeAfter = { title: string; before: string; after: string };
type EventItem = { title: string; date: string; description: string; image: string; location: string };
type Partner = { name: string; logo: string; url: string };

const inputCls = "bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-11";
const labelCls = "text-slate-400 font-bold uppercase text-[10px] tracking-widest";

export function PortalContentEditor({ userId }: { userId?: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [beforeAfter, setBeforeAfter] = useState<BeforeAfter[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("portal_before_after, portal_events, portal_partners")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      if (error) toast.error("Erro ao carregar conteúdo do portal");
      const d = data as any;
      setBeforeAfter(Array.isArray(d?.portal_before_after) ? d.portal_before_after : []);
      setEvents(Array.isArray(d?.portal_events) ? d.portal_events : []);
      setPartners(Array.isArray(d?.portal_partners) ? d.portal_partners : []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!userId) return null;
    try {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const fileName = `${userId}-portal-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("barber-avatars").upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from("barber-avatars").getPublicUrl(fileName);
      return data.publicUrl;
    } catch (e: any) {
      toast.error("Erro ao enviar imagem: " + e.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        portal_before_after: beforeAfter.filter((i) => i.before && i.after),
        portal_events: events.filter((e) => e.title),
        portal_partners: partners.filter((p) => p.name),
      } as any)
      .eq("id", userId);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Conteúdo do portal atualizado!");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-widest font-bold py-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando conteúdo do portal...
      </div>
    );
  }

  const ImageField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (url: string) => void;
  }) => (
    <div className="grid gap-2">
      <Label className={labelCls}>{label}</Label>
      {value && (
        <img src={value} alt={label} className="h-24 w-full rounded-xl object-cover border border-[#1f2937]" />
      )}
      <Input
        type="file"
        accept="image/*"
        disabled={uploading}
        className="h-11 rounded-xl cursor-pointer bg-[#05070d] border-[#1f2937] text-white file:bg-[#ea580c] file:text-black file:font-bold file:border-none file:px-4 file:h-full file:mr-4"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = await uploadImage(file);
          if (url) onChange(url);
          (e.target as HTMLInputElement).value = "";
        }}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou cole uma URL"
        className={inputCls}
      />
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Antes e Depois */}
      <div className="space-y-4">
        <div>
          <h4 className="font-black uppercase italic text-[#ea580c] text-xs tracking-[0.2em]">Antes & Depois</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Pares de fotos com comparador interativo na página pública. Sem itens, a seção não aparece.
          </p>
        </div>
        {beforeAfter.map((item, idx) => (
          <div key={idx} className="bg-[#05070d]/30 p-5 rounded-2xl border border-[#1f2937]/30 space-y-4 relative">
            <button
              type="button"
              onClick={() => setBeforeAfter(beforeAfter.filter((_, i) => i !== idx))}
              className="absolute top-3 right-3 h-8 w-8 rounded-lg bg-black/70 border border-red-500/40 text-red-400 flex items-center justify-center hover:bg-red-500/20"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="grid gap-2">
              <Label className={labelCls}>Título</Label>
              <Input
                value={item.title}
                onChange={(e) => {
                  const next = [...beforeAfter];
                  next[idx] = { ...item, title: e.target.value };
                  setBeforeAfter(next);
                }}
                placeholder="Ex: Degradê navalhado"
                className={inputCls}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <ImageField
                label="Foto Antes"
                value={item.before}
                onChange={(url) => {
                  const next = [...beforeAfter];
                  next[idx] = { ...item, before: url };
                  setBeforeAfter(next);
                }}
              />
              <ImageField
                label="Foto Depois"
                value={item.after}
                onChange={(url) => {
                  const next = [...beforeAfter];
                  next[idx] = { ...item, after: url };
                  setBeforeAfter(next);
                }}
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setBeforeAfter([...beforeAfter, { title: "", before: "", after: "" }])}
          className="rounded-xl border-[#1f2937] bg-transparent text-slate-300 hover:text-white hover:border-[#ea580c]"
        >
          <Plus className="h-4 w-4 mr-2" /> Adicionar par
        </Button>
      </div>

      {/* Eventos */}
      <div className="space-y-4 pt-6 border-t border-[#1f2937]/50">
        <div>
          <h4 className="font-black uppercase italic text-[#ea580c] text-xs tracking-[0.2em]">Eventos</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Workshops, lives, ações sociais e datas especiais.</p>
        </div>
        {events.map((item, idx) => (
          <div key={idx} className="bg-[#05070d]/30 p-5 rounded-2xl border border-[#1f2937]/30 space-y-4 relative">
            <button
              type="button"
              onClick={() => setEvents(events.filter((_, i) => i !== idx))}
              className="absolute top-3 right-3 h-8 w-8 rounded-lg bg-black/70 border border-red-500/40 text-red-400 flex items-center justify-center hover:bg-red-500/20"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className={labelCls}>Nome do evento</Label>
                <Input
                  value={item.title}
                  onChange={(e) => {
                    const next = [...events];
                    next[idx] = { ...item, title: e.target.value };
                    setEvents(next);
                  }}
                  className={inputCls}
                />
              </div>
              <div className="grid gap-2">
                <Label className={labelCls}>Data</Label>
                <Input
                  type="date"
                  value={item.date}
                  onChange={(e) => {
                    const next = [...events];
                    next[idx] = { ...item, date: e.target.value };
                    setEvents(next);
                  }}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className={labelCls}>Descrição</Label>
              <Textarea
                value={item.description}
                onChange={(e) => {
                  const next = [...events];
                  next[idx] = { ...item, description: e.target.value };
                  setEvents(next);
                }}
                className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label className={labelCls}>Local (opcional)</Label>
              <Input
                value={item.location}
                onChange={(e) => {
                  const next = [...events];
                  next[idx] = { ...item, location: e.target.value };
                  setEvents(next);
                }}
                className={inputCls}
              />
            </div>
            <ImageField
              label="Imagem do evento"
              value={item.image}
              onChange={(url) => {
                const next = [...events];
                next[idx] = { ...item, image: url };
                setEvents(next);
              }}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setEvents([...events, { title: "", date: "", description: "", image: "", location: "" }])}
          className="rounded-xl border-[#1f2937] bg-transparent text-slate-300 hover:text-white hover:border-[#ea580c]"
        >
          <Plus className="h-4 w-4 mr-2" /> Adicionar evento
        </Button>
      </div>

      {/* Parceiros */}
      <div className="space-y-4 pt-6 border-t border-[#1f2937]/50">
        <div>
          <h4 className="font-black uppercase italic text-[#ea580c] text-xs tracking-[0.2em]">Parceiros</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Marcas e negócios parceiros exibidos com logo na página pública.</p>
        </div>
        {partners.map((item, idx) => (
          <div key={idx} className="bg-[#05070d]/30 p-5 rounded-2xl border border-[#1f2937]/30 space-y-4 relative">
            <button
              type="button"
              onClick={() => setPartners(partners.filter((_, i) => i !== idx))}
              className="absolute top-3 right-3 h-8 w-8 rounded-lg bg-black/70 border border-red-500/40 text-red-400 flex items-center justify-center hover:bg-red-500/20"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className={labelCls}>Nome</Label>
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const next = [...partners];
                    next[idx] = { ...item, name: e.target.value };
                    setPartners(next);
                  }}
                  className={inputCls}
                />
              </div>
              <div className="grid gap-2">
                <Label className={labelCls}>Site / Instagram (opcional)</Label>
                <Input
                  value={item.url}
                  onChange={(e) => {
                    const next = [...partners];
                    next[idx] = { ...item, url: e.target.value };
                    setPartners(next);
                  }}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>
            </div>
            <ImageField
              label="Logo"
              value={item.logo}
              onChange={(url) => {
                const next = [...partners];
                next[idx] = { ...item, logo: url };
                setPartners(next);
              }}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setPartners([...partners, { name: "", logo: "", url: "" }])}
          className="rounded-xl border-[#1f2937] bg-transparent text-slate-300 hover:text-white hover:border-[#ea580c]"
        >
          <Plus className="h-4 w-4 mr-2" /> Adicionar parceiro
        </Button>
      </div>

      <Button
        type="button"
        onClick={save}
        disabled={saving || uploading}
        className="h-11 rounded-xl bg-[#ea580c] text-black font-black uppercase tracking-widest hover:bg-[#ea580c]/90"
      >
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar conteúdo do portal
      </Button>
    </div>
  );
}
