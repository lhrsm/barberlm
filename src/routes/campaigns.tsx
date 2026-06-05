import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Megaphone, 
  Plus, 
  Send, 
  Calendar, 
  Users, 
  BarChart3, 
  Copy, 
  Trash2, 
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  MegaphoneOff
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/campaigns")({
  component: CampaignsComponent,
});

function CampaignsComponent() {
  const { tenantId } = useTenant();
  const { plan } = usePlanLimits();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    title: "",
    content: "",
    scheduled_at: "",
    filters: {}
  });

  useEffect(() => {
    if (tenantId) {
      fetchCampaigns();
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

  async function handleCreateCampaign() {
    if (!tenantId) return;
    
    const { error } = await supabase
      .from("campaigns")
      .insert({
        tenant_id: tenantId,
        title: newCampaign.title,
        content: newCampaign.content,
        scheduled_at: newCampaign.scheduled_at || null,
        status: newCampaign.scheduled_at ? 'scheduled' : 'draft'
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
    
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id);
    
    if (!error) {
      toast.success("Campanha excluída!");
      fetchCampaigns();
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500">Enviada</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="text-blue-500 border-blue-500">Agendada</Badge>;
      case 'sending':
        return <Badge className="bg-amber-500 animate-pulse">Enviando...</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="secondary">Rascunho</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Marketing</h2>
            <p className="text-muted-foreground text-sm">Crie e envie campanhas em massa.</p>
          </div>
          <Button className="gap-2" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} /> Nova Campanha
          </Button>
        </div>

        <div className="grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-4">
          <Card className="p-4 md:p-6 flex flex-col items-center md:items-start text-center md:text-left">
            <CardDescription className="text-[10px] md:text-sm font-bold uppercase tracking-wider">Total Enviado</CardDescription>
            <CardTitle className="text-xl md:text-2xl font-black">1.284</CardTitle>
          </Card>
          <Card className="p-4 md:p-6 flex flex-col items-center md:items-start text-center md:text-left">
            <CardDescription className="text-[10px] md:text-sm font-bold uppercase tracking-wider">Taxa Abertura</CardDescription>
            <CardTitle className="text-xl md:text-2xl font-black text-green-600">94.2%</CardTitle>
          </Card>
          <Card className="p-4 md:p-6 flex flex-col items-center md:items-start text-center md:text-left">
            <CardDescription className="text-[10px] md:text-sm font-bold uppercase tracking-wider">Taxa Resposta</CardDescription>
            <CardTitle className="text-xl md:text-2xl font-black text-blue-600">12.5%</CardTitle>
          </Card>
          <Card className="p-4 md:p-6 flex flex-col items-center md:items-start text-center md:text-left">
            <CardDescription className="text-[10px] md:text-sm font-bold uppercase tracking-wider">Clientes VIP</CardDescription>
            <CardTitle className="text-xl md:text-2xl font-black text-purple-600">42</CardTitle>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-lg">Minhas Campanhas</h3>
          <div className="grid gap-4">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : campaigns.length === 0 ? (
              <div className="p-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                <MegaphoneOff size={48} className="mx-auto mb-4 opacity-20" />
                <h4 className="text-lg font-semibold">Nenhuma campanha encontrada</h4>
                <p className="text-muted-foreground mt-1">Clique no botão "Nova Campanha" para começar.</p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <Card key={campaign.id} className="overflow-hidden">
                  <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-lg">{campaign.title}</h4>
                        {getStatusBadge(campaign.status)}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{campaign.content}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-[10px] md:text-xs text-muted-foreground font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> Criada: {new Date(campaign.created_at).toLocaleDateString()}
                        </span>
                        {campaign.scheduled_at && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Clock size={12} /> Agendada: {new Date(campaign.scheduled_at).toLocaleString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {campaign.total_recipients || 0} envios
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Button variant="outline" size="sm" className="flex-1 md:flex-none gap-2 rounded-xl h-10">
                        <BarChart3 size={14} /> Stats
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2">
                            <Copy size={14} /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDeleteCampaign(campaign.id)}>
                            <Trash2 size={14} /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Create Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
              <DialogDescription>Preencha os detalhes da sua campanha de marketing.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título da Campanha (Interno)</Label>
                <Input 
                  id="title" 
                  placeholder="Ex: Promoção de Natal 2024"
                  value={newCampaign.title}
                  onChange={(e) => setNewCampaign({...newCampaign, title: e.target.value})}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Conteúdo da Mensagem</Label>
                  <Button variant="ghost" size="sm" className="text-primary gap-2 h-8" onClick={() => toast.info("IA em breve nesta tela")}>
                    Gerar com IA
                  </Button>
                </div>
                <Textarea 
                  rows={6} 
                  placeholder="Olá {{cliente_nome}}..."
                  value={newCampaign.content}
                  onChange={(e) => setNewCampaign({...newCampaign, content: e.target.value})}
                />
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {['cliente_nome', 'barbearia_nome', 'link_agendamento'].map(tag => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer">
                      {"{{"}{tag}{"}}"}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Público-Alvo</Label>
                  <Select defaultValue="all">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Clientes</SelectItem>
                      <SelectItem value="vip">Clientes VIP (Frequentes)</SelectItem>
                      <SelectItem value="inactive">Clientes Inativos</SelectItem>
                      <SelectItem value="birthday">Aniversariantes do Mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Agendar Envio (Opcional)</Label>
                  <Input 
                    type="datetime-local" 
                    value={newCampaign.scheduled_at}
                    onChange={(e) => setNewCampaign({...newCampaign, scheduled_at: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex gap-3">
                <AlertCircle className="text-amber-600 shrink-0" size={20} />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-amber-800">Atenção ao Envio:</p>
                  <p className="text-amber-700">Evite enviar muitas mensagens em curto espaço de tempo para não ter seu número bloqueado pelo WhatsApp.</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateCampaign} disabled={!newCampaign.title || !newCampaign.content}>
                {newCampaign.scheduled_at ? 'Agendar Campanha' : 'Criar como Rascunho'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export default CampaignsComponent;
