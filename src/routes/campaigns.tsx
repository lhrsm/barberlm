import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Calendar,
  Users,
  BarChart3,
  Copy,
  Trash2,
  MoreVertical,
  Clock,
  AlertCircle,
  MegaphoneOff,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/campaigns")({
  component: CampaignsComponent,
});

function CampaignsComponent() {
  const { tenantId } = useTenant();
  const { plan } = usePlanLimits();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [metrics, setMetrics] = useState({
    totalSent: 0,
    openRate: 0,
    responseRate: 0,
    vipCustomers: 0,
  });
  const [newCampaign, setNewCampaign] = useState({
    title: "",
    content: "",
    scheduled_at: "",
    filters: {},
  });

  useEffect(() => {
    if (tenantId) {
      fetchCampaigns();
      fetchMetrics();
    }
  }, [tenantId]);

  async function fetchCampaigns() {
    if (!tenantId) return;
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (data) setCampaigns(data);
    setLoading(false);
  }

  async function fetchMetrics() {
    if (!tenantId) return;

    const { data: logs } = await supabase
      .from("campaign_logs")
      .select("status, response")
      .eq("tenant_id", tenantId);

    const totalSent = logs?.length || 0;
    const opened = logs?.filter((l: any) =>
      ["read", "opened", "delivered"].includes((l.status || "").toLowerCase())
    ).length || 0;
    const responded = logs?.filter((l: any) => l.response != null && l.response !== "").length || 0;

    const { count: vipCount } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gt("loyalty_points", 0);

    setMetrics({
      totalSent,
      openRate: totalSent > 0 ? (opened / totalSent) * 100 : 0,
      responseRate: totalSent > 0 ? (responded / totalSent) * 100 : 0,
      vipCustomers: vipCount || 0,
    });
  }

  async function handleCreateCampaign() {
    if (!tenantId) return;
    const { error } = await supabase.from("campaigns").insert({
      tenant_id: tenantId,
      title: newCampaign.title,
      content: newCampaign.content,
      scheduled_at: newCampaign.scheduled_at || null,
      status: newCampaign.scheduled_at ? "scheduled" : "draft",
    });

    if (error) {
      toast.error("Erro ao criar campanha");
    } else {
      toast.success("Campanha criada com sucesso!");
      setIsAddModalOpen(false);
      setNewCampaign({ title: "", content: "", scheduled_at: "", filters: {} });
      fetchCampaigns();
    }
  }

  async function handleDeleteCampaign(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (!error) {
      toast.success("Campanha excluída!");
      fetchCampaigns();
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Enviada</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30">Agendada</Badge>;
      case "sending":
        return <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">Enviando...</Badge>;
      case "failed":
        return <Badge className="bg-red-500/15 text-red-400 border border-red-500/30">Falhou</Badge>;
      default:
        return <Badge className="bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">Rascunho</Badge>;
    }
  };

  const stats = [
    { label: "Total Enviado", value: "1.284", color: "text-white" },
    { label: "Taxa Abertura", value: "94.2%", color: "text-emerald-400" },
    { label: "Taxa Resposta", value: "12.5%", color: "text-blue-400" },
    { label: "Clientes VIP", value: "42", color: "text-[#f59e0b]" },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {/* HEADER */}
          <header className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
                <Megaphone className="h-7 w-7 text-[#f59e0b]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate">Marketing</h1>
                <p className="text-sm text-zinc-400 mt-1 truncate">
                  Crie e envie campanhas em massa para fidelizar seus clientes.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="h-[42px] px-[18px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.45)] transition-all hover:-translate-y-0.5 w-full sm:w-auto"
            >
              <Plus size={18} className="mr-2" /> Nova Campanha
            </Button>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5"
              >
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {s.label}
                </p>
                <p className={`text-2xl md:text-3xl font-black mt-2 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Campaigns List */}
          <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <Megaphone className="h-5 w-5 text-[#f59e0b]" />
                Minhas Campanhas
              </h3>
              <span className="text-xs text-zinc-400">{campaigns.length} no total</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-[#f59e0b]" />
                <p className="text-zinc-400">Carregando campanhas...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-[#05070d] border-zinc-800">
                <MegaphoneOff className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <h4 className="text-lg font-bold">Nenhuma campanha encontrada</h4>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto mt-2">
                  Clique em "Nova Campanha" para criar a sua primeira.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="bg-[#05070d] border border-zinc-800 rounded-2xl p-5 hover:border-[#f59e0b]/30 transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="font-bold text-lg text-white truncate">{campaign.title}</h4>
                          {getStatusBadge(campaign.status)}
                        </div>
                        <p className="text-sm text-zinc-400 line-clamp-1">{campaign.content}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-xs text-zinc-500 font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} /> {new Date(campaign.created_at).toLocaleDateString()}
                          </span>
                          {campaign.scheduled_at && (
                            <span className="flex items-center gap-1.5 text-blue-400">
                              <Clock size={12} /> {new Date(campaign.scheduled_at).toLocaleString()}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Users size={12} /> {campaign.total_recipients || 0} envios
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 md:flex-none gap-2 h-[42px] rounded-xl bg-transparent border-zinc-800 text-zinc-300 hover:text-white hover:border-[#f59e0b]/40 hover:bg-[#f59e0b]/5"
                        >
                          <BarChart3 size={14} /> Stats
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-[42px] w-[42px] rounded-xl text-zinc-400 hover:text-white hover:bg-white/5"
                            >
                              <MoreVertical size={18} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#0b0f17] border-zinc-800">
                            <DropdownMenuItem className="gap-2 text-zinc-300 focus:bg-white/5 focus:text-white">
                              <Copy size={14} /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-400"
                              onClick={() => handleDeleteCampaign(campaign.id)}
                            >
                              <Trash2 size={14} /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Modal */}
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0b0f17] border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Criar Nova Campanha</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Preencha os detalhes da sua campanha de marketing.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-zinc-300">Título da Campanha (Interno)</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Promoção de Natal 2024"
                    value={newCampaign.title}
                    onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                    className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-300">Conteúdo da Mensagem</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#f59e0b] hover:text-[#fbbf24] hover:bg-[#f59e0b]/10 gap-2 h-8 rounded-lg"
                      onClick={() => toast.info("IA em breve nesta tela")}
                    >
                      Gerar com IA
                    </Button>
                  </div>
                  <Textarea
                    rows={6}
                    placeholder="Olá {{cliente_nome}}..."
                    value={newCampaign.content}
                    onChange={(e) => setNewCampaign({ ...newCampaign, content: e.target.value })}
                    className="rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                  />
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {["cliente_nome", "barbearia_nome", "link_agendamento"].map((tag) => (
                      <Badge
                        key={tag}
                        className="cursor-pointer bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 hover:bg-[#f59e0b]/20"
                      >
                        {"{{"}{tag}{"}}"}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Público-Alvo</Label>
                    <Select defaultValue="all">
                      <SelectTrigger className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0b0f17] border-zinc-800 text-white">
                        <SelectItem value="all">Todos os Clientes</SelectItem>
                        <SelectItem value="vip">Clientes VIP (Frequentes)</SelectItem>
                        <SelectItem value="inactive">Clientes Inativos</SelectItem>
                        <SelectItem value="birthday">Aniversariantes do Mês</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Agendar Envio (Opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={newCampaign.scheduled_at}
                      onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_at: e.target.value })}
                      className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                    />
                  </div>
                </div>

                <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/30 flex gap-3">
                  <AlertCircle className="text-amber-400 shrink-0" size={20} />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-amber-300">Atenção ao Envio:</p>
                    <p className="text-amber-200/80">
                      Evite enviar muitas mensagens em curto espaço de tempo para não ter seu número bloqueado pelo WhatsApp.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-[42px] rounded-xl text-zinc-400 hover:text-white hover:bg-white/5"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateCampaign}
                  disabled={!newCampaign.title || !newCampaign.content}
                  className="h-[42px] px-[18px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.45)] transition-all"
                >
                  {newCampaign.scheduled_at ? "Agendar Campanha" : "Criar como Rascunho"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AppLayout>
  );
}

export default CampaignsComponent;
