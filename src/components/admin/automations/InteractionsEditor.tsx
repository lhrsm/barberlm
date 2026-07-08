import React, { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ActionType =
  | "confirm_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "open_portal"
  | "open_public_page"
  | "review"
  | "renew_subscription"
  | "change_plan"
  | "buy_product"
  | "talk_to_shop"
  | "webhook"
  | "edge_function"
  | "api_call"
  | "start_flow";

export const ACTION_TYPES: { value: ActionType; label: string; defaultIcon: string; defaultColor: string }[] = [
  { value: "confirm_appointment", label: "Confirmar agendamento", defaultIcon: "✔", defaultColor: "green" },
  { value: "reschedule_appointment", label: "Reagendar", defaultIcon: "📅", defaultColor: "blue" },
  { value: "cancel_appointment", label: "Cancelar agendamento", defaultIcon: "❌", defaultColor: "red" },
  { value: "open_portal", label: "Abrir Portal do Cliente", defaultIcon: "👤", defaultColor: "blue" },
  { value: "open_public_page", label: "Abrir Página Pública", defaultIcon: "🌐", defaultColor: "gray" },
  { value: "review", label: "Avaliar atendimento", defaultIcon: "⭐", defaultColor: "gold" },
  { value: "renew_subscription", label: "Renovar assinatura", defaultIcon: "🔄", defaultColor: "gold" },
  { value: "change_plan", label: "Alterar plano", defaultIcon: "📋", defaultColor: "blue" },
  { value: "buy_product", label: "Comprar produto", defaultIcon: "🛒", defaultColor: "green" },
  { value: "talk_to_shop", label: "Abrir conversa humana", defaultIcon: "💬", defaultColor: "blue" },
  { value: "webhook", label: "Executar Webhook", defaultIcon: "⚡", defaultColor: "gray" },
  { value: "edge_function", label: "Executar Edge Function", defaultIcon: "⚡", defaultColor: "gray" },
  { value: "api_call", label: "Chamar API", defaultIcon: "🔗", defaultColor: "gray" },
  { value: "start_flow", label: "Iniciar fluxo personalizado", defaultIcon: "🌟", defaultColor: "gold" },
];

const ICONS = ["✔", "❌", "📅", "💬", "⭐", "🔄", "📋", "🛒", "👤", "🌐", "⚡", "🔗", "🌟", "🎁", "💳"];
const COLORS = [
  { value: "green", label: "Verde", cls: "bg-green-500" },
  { value: "blue", label: "Azul", cls: "bg-blue-500" },
  { value: "red", label: "Vermelho", cls: "bg-red-500" },
  { value: "gold", label: "Dourado", cls: "bg-yellow-500" },
  { value: "gray", label: "Cinza", cls: "bg-gray-500" },
];

const CONDITIONS = [
  { value: "payment_pending", label: "Pagamento pendente" },
  { value: "subscription_active", label: "Assinatura ativa" },
  { value: "vip_customer", label: "Cliente VIP" },
  { value: "has_cashback", label: "Possui cashback" },
  { value: "has_credits", label: "Possui créditos" },
  { value: "not_confirmed", label: "Atendimento ainda não confirmado" },
  { value: "not_started", label: "Atendimento ainda não iniciado" },
  { value: "more_than_2h", label: "Horário superior a 2 horas" },
];

export interface Interaction {
  id?: string;
  button_title: string;
  button_icon: string;
  button_color: string;
  action_type: ActionType;
  action_payload: Record<string, any>;
  success_message: string;
  conditions: string[];
  display_order: number;
  active: boolean;
  _dirty?: boolean;
  _new?: boolean;
}

interface Props {
  tenantId: string;
  automationTemplateId: string;
}

export interface InteractionsEditorHandle {
  save: () => Promise<boolean>;
  isDirty: () => boolean;
}

export const InteractionsEditor = forwardRef<InteractionsEditorHandle, Props>(function InteractionsEditor(
  { tenantId, automationTemplateId },
  ref,
) {
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("automation_interactions")
        .select("*")
        .eq("automation_template_id", automationTemplateId)
        .order("display_order", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("Erro ao carregar interações: " + error.message);
        setItems([]);
      } else {
        setItems(
          (data || []).map((d: any) => ({
            id: d.id,
            button_title: d.button_title,
            button_icon: d.button_icon || "",
            button_color: d.button_color || "gray",
            action_type: d.action_type,
            action_payload: d.action_payload || {},
            success_message: d.success_message || "",
            conditions: Array.isArray(d.conditions) ? d.conditions : [],
            display_order: d.display_order ?? 0,
            active: d.active ?? true,
          }))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [automationTemplateId]);

  const addInteraction = () => {
    const def = ACTION_TYPES[0];
    setItems((prev) => [
      ...prev,
      {
        button_title: "Confirmar",
        button_icon: def.defaultIcon,
        button_color: def.defaultColor,
        action_type: def.value,
        action_payload: {},
        success_message: "",
        conditions: [],
        display_order: prev.length,
        active: true,
        _new: true,
        _dirty: true,
      },
    ]);
  };

  const updateItem = (idx: number, patch: Partial<Interaction>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch, _dirty: true } : it))
    );
  };

  const onActionTypeChange = (idx: number, value: ActionType) => {
    const def = ACTION_TYPES.find((a) => a.value === value);
    const current = items[idx];
    updateItem(idx, {
      action_type: value,
      button_icon: current.button_icon || def?.defaultIcon || "",
      button_color: current.button_color || def?.defaultColor || "gray",
    });
  };

  const removeItem = (idx: number) => {
    const it = items[idx];
    if (it.id) setDeletedIds((prev) => [...prev, it.id!]);
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    next.forEach((it, i) => (it.display_order = i));
    setItems(next.map((it) => ({ ...it, _dirty: true })));
  };

  const toggleCondition = (idx: number, cond: string) => {
    const it = items[idx];
    const has = it.conditions.includes(cond);
    updateItem(idx, {
      conditions: has ? it.conditions.filter((c) => c !== cond) : [...it.conditions, cond],
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      if (deletedIds.length > 0) {
        const { error } = await (supabase as any)
          .from("automation_interactions")
          .delete()
          .in("id", deletedIds);
        if (error) throw error;
      }
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const payload = {
          tenant_id: tenantId,
          automation_template_id: automationTemplateId,
          button_title: it.button_title,
          button_icon: it.button_icon || null,
          button_color: it.button_color,
          action_type: it.action_type,
          action_payload: it.action_payload || {},
          success_message: it.success_message || null,
          conditions: it.conditions || [],
          display_order: i,
          active: it.active,
        };
        if (it.id) {
          const { error } = await (supabase as any)
            .from("automation_interactions")
            .update(payload)
            .eq("id", it.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any)
            .from("automation_interactions")
            .insert(payload);
          if (error) throw error;
        }
      }
      setDeletedIds([]);
      toast.success("Interações salvas!");
    } catch (e: any) {
      toast.error("Erro ao salvar interações: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = deletedIds.length > 0 || items.some((it) => it._dirty);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Interações da mensagem</h4>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addInteraction}>
            <Plus className="h-3 w-3 mr-1" /> Nova interação
          </Button>
          {isDirty && (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar interações"}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Configure botões inteligentes que serão enviados junto à mensagem. Quando o cliente clicar, a ação é executada
        automaticamente.
      </p>

      {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}

      {!loading && items.length === 0 && (
        <div className="border border-dashed rounded-md p-6 text-center text-xs text-muted-foreground">
          Nenhuma interação configurada. Clique em <strong>Nova interação</strong> para começar.
        </div>
      )}

      {items.map((it, idx) => (
        <Card key={it.id || `new-${idx}`} className="border-l-4" style={{ borderLeftColor: colorHex(it.button_color) }}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{it.button_icon}</span>
                <Badge variant="outline" className="text-[10px]">
                  {ACTION_TYPES.find((a) => a.value === it.action_type)?.label || it.action_type}
                </Badge>
                {!it.active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Título do botão</Label>
                <Input
                  value={it.button_title}
                  onChange={(e) => updateItem(idx, { button_title: e.target.value })}
                  placeholder="Confirmar"
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Tipo da ação</Label>
                <Select value={it.action_type} onValueChange={(v) => onActionTypeChange(idx, v as ActionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.defaultIcon} {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Ícone</Label>
                <div className="flex flex-wrap gap-1">
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => updateItem(idx, { button_icon: ic })}
                      className={`h-8 w-8 rounded border text-base ${
                        it.button_icon === ic ? "border-primary bg-primary/10" : "border-border"
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Cor</Label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => updateItem(idx, { button_color: c.value })}
                      className={`h-8 w-8 rounded-full ${c.cls} ${
                        it.button_color === c.value ? "ring-2 ring-offset-2 ring-primary" : ""
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Mensagem de resposta (após clique)</Label>
              <Textarea
                rows={2}
                value={it.success_message}
                onChange={(e) => updateItem(idx, { success_message: e.target.value })}
                placeholder="Perfeito! Seu horário foi confirmado. Até breve!"
              />
            </div>

            {(it.action_type === "webhook" || it.action_type === "api_call" || it.action_type === "edge_function") && (
              <div className="grid gap-1">
                <Label className="text-xs">URL / Nome da função</Label>
                <Input
                  value={it.action_payload?.url || it.action_payload?.function_name || ""}
                  onChange={(e) =>
                    updateItem(idx, {
                      action_payload: {
                        ...it.action_payload,
                        [it.action_type === "edge_function" ? "function_name" : "url"]: e.target.value,
                      },
                    })
                  }
                  placeholder={it.action_type === "edge_function" ? "nome-da-funcao" : "https://..."}
                />
              </div>
            )}

            {it.action_type === "start_flow" && (
              <div className="grid gap-1">
                <Label className="text-xs">ID do fluxo</Label>
                <Input
                  value={it.action_payload?.flow_id || ""}
                  onChange={(e) =>
                    updateItem(idx, { action_payload: { ...it.action_payload, flow_id: e.target.value } })
                  }
                  placeholder="ID de fluxo personalizado"
                />
              </div>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Condições (mostrar botão apenas se...)
              </summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CONDITIONS.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={it.conditions.includes(c.value)}
                      onChange={() => toggleCondition(idx, c.value)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </details>

            <div className="flex items-center justify-between pt-1 border-t">
              <Label className="text-xs">Ativa</Label>
              <Switch
                checked={it.active}
                onCheckedChange={(v) => updateItem(idx, { active: v })}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

function colorHex(c: string) {
  switch (c) {
    case "green":
      return "#22c55e";
    case "blue":
      return "#3b82f6";
    case "red":
      return "#ef4444";
    case "gold":
      return "#eab308";
    default:
      return "#6b7280";
  }
}
