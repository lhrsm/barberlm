import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, UserRound, Phone, Mail, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/barbers")({
  component: BarbersComponent,
});

function BarbersComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [barbers, setBarbers] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<any>(null);
  const [newBarber, setNewBarber] = useState({ name: "", phone: "", email: "", avatar_url: "", category: "Proprietário", commission_rate: 0 });
  const canAddBarber = checkLimit("barbers");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchBarbers();
  }, [user]);

  async function fetchBarbers() {
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) toast.error("Erro ao buscar barbeiros");
    else setBarbers(data || []);
  }

  async function handleAddBarber(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from("barbers").insert({
      ...newBarber,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erro ao adicionar barbeiro");
    } else {
      toast.success("Barbeiro cadastrado com sucesso!");
      setIsAddDialogOpen(false);
      setNewBarber({ name: "", phone: "", email: "", avatar_url: "", category: "Proprietário", commission_rate: 0 });
      fetchBarbers();
      refreshLimits();
    }
  async function handleUpdateBarber(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBarber) return;

    const { error } = await supabase
      .from("barbers")
      .update({
        name: editingBarber.name,
        phone: editingBarber.phone,
        email: editingBarber.email,
        avatar_url: editingBarber.avatar_url,
        category: editingBarber.category,
        commission_rate: editingBarber.commission_rate,
      })
      .eq("id", editingBarber.id);

    if (error) {
      toast.error("Erro ao atualizar barbeiro");
    } else {
      toast.success("Barbeiro atualizado com sucesso!");
      setIsEditDialogOpen(false);
      setEditingBarber(null);
      fetchBarbers();
    }
  }

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Profissionais</h2>
            <p className="text-muted-foreground">Cadastre os barbeiros da sua equipe.</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant={canAddBarber ? "default" : "secondary"}>
                <UserPlus size={18} /> Novo Barbeiro
              </Button>
            </DialogTrigger>
            <DialogContent>
              {canAddBarber ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Barbeiro</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddBarber} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="avatar_url">URL da Foto</Label>
                      <Input 
                        id="avatar_url" 
                        placeholder="https://exemplo.com/foto.jpg"
                        value={newBarber.avatar_url} 
                        onChange={(e) => setNewBarber({...newBarber, avatar_url: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Profissional</Label>
                      <Input 
                        id="name" 
                        placeholder="João Silva"
                        value={newBarber.name} 
                        onChange={(e) => setNewBarber({...newBarber, name: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Categoria</Label>
                        <Select 
                          value={newBarber.category} 
                          onValueChange={(value) => setNewBarber({
                            ...newBarber, 
                            category: value,
                            commission_rate: value === 'Freelancer' ? 50 : 0
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Proprietário">Proprietário</SelectItem>
                            <SelectItem value="Freelancer">Freelancer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {newBarber.category === 'Freelancer' && (
                        <div className="space-y-2">
                          <Label htmlFor="commission">Comissão (%)</Label>
                          <Input 
                            id="commission" 
                            type="number"
                            value={newBarber.commission_rate} 
                            onChange={(e) => setNewBarber({...newBarber, commission_rate: Number(e.target.value)})} 
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input 
                        id="phone" 
                        placeholder="(00) 00000-0000"
                        value={newBarber.phone} 
                        onChange={(e) => setNewBarber({...newBarber, phone: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email (Opcional)</Label>
                      <Input 
                        id="email" 
                        type="email"
                        value={newBarber.email} 
                        onChange={(e) => setNewBarber({...newBarber, email: e.target.value})} 
                      />
                    </div>
                    <Button type="submit" className="w-full">Salvar Barbeiro</Button>
                  </form>
                </>
              ) : (
                <div className="space-y-4 py-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Limite Atingido</AlertTitle>
                    <AlertDescription>
                      Seu plano atual permite apenas 1 profissional. Faça o upgrade para o plano Pro para adicionar mais.
                    </AlertDescription>
                  </Alert>
                  <Button className="w-full" asChild>
                    <Link to="/subscription">Ver Planos</Link>
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {!canAddBarber && (
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              Você atingiu o limite de profissionais do plano gratuito.
              <Button variant="link" size="sm" asChild className="p-0 h-auto">
                <Link to="/subscription">Fazer Upgrade</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {barbers.length === 0 ? (
            <div className="col-span-full text-center py-12 border rounded-xl bg-card text-muted-foreground">
              <UserRound size={48} className="mx-auto mb-4 opacity-20" />
              <p>Nenhum profissional cadastrado ainda.</p>
            </div>
          ) : (
            barbers.map((barber) => (
              <div key={barber.id} className="p-6 border rounded-xl bg-card shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-12 w-12">
                    {barber.avatar_url ? (
                      <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {barber.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">{barber.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Ativo</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        barber.category === 'Freelancer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {barber.category}
                      </span>
                      {barber.category === 'Freelancer' && (
                        <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                          {barber.commission_rate}% Comissão
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone size={14} />
                    <span>{barber.phone || "Não informado"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} />
                    <span>{barber.email || "Não informado"}</span>
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.info("Relatório em breve")}>Desempenho</Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setEditingBarber(barber);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// Add Crown to imports
import { Crown } from "lucide-react";
