import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Scissors, Plus, Clock, AlertTriangle, Crown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/services")({
  component: ServicesComponent,
});

function ServicesComponent() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const { limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [services, setServices] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newService, setNewService] = useState({ name: "", price: "", duration_minutes: "30", description: "" });
  const canAddService = checkLimit("services");

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
      return;
    }

    if (!loading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, loading, role, navigate]);

  useEffect(() => {
    if (user && role !== 'super_admin') fetchServices();
  }, [user, role]);

  async function fetchServices() {
    if (!user) return;
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("name");
    if (error) toast.error("Erro ao buscar serviços");
    else setServices(data || []);
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from("services").insert({
      ...newService,
      price: parseFloat(newService.price),
      duration_minutes: parseInt(newService.duration_minutes),
      user_id: user.id,
    });

    if (error) {
      toast.error("Erro ao adicionar serviço");
    } else {
      toast.success("Serviço adicionado com sucesso!");
      setIsAddDialogOpen(false);
      setNewService({ name: "", price: "", duration_minutes: "30", description: "" });
      fetchServices();
      refreshLimits();
    }
  }

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Serviços</h2>
            <p className="text-muted-foreground">Cadastre os serviços oferecidos e seus valores.</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant={canAddService ? "default" : "secondary"}>
                <Plus size={18} /> Novo Serviço
              </Button>
            </DialogTrigger>
            <DialogContent>
              {canAddService ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Serviço</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddService} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Serviço</Label>
                      <Input 
                        id="name" 
                        placeholder="Corte Degradê, Barba, etc."
                        value={newService.name} 
                        onChange={(e) => setNewService({...newService, name: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Preço (R$)</Label>
                        <Input 
                          id="price" 
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={newService.price} 
                          onChange={(e) => setNewService({...newService, price: e.target.value})} 
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duração (min)</Label>
                        <Input 
                          id="duration" 
                          type="number"
                          value={newService.duration_minutes} 
                          onChange={(e) => setNewService({...newService, duration_minutes: e.target.value})} 
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição (Opcional)</Label>
                      <Input 
                        id="description" 
                        value={newService.description} 
                        onChange={(e) => setNewService({...newService, description: e.target.value})} 
                      />
                    </div>
                    <Button type="submit" className="w-full">Salvar Serviço</Button>
                  </form>
                </>
              ) : (
                <div className="space-y-4 py-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Limite Atingido</AlertTitle>
                    <AlertDescription>
                      Seu plano atual permite apenas {limits.services} serviços. Faça o upgrade para o plano Pro para adicionar ilimitados.
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

        {!canAddService && (
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertTitle>Limite de Serviços</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              Você atingiu o limite de {limits.services} serviços do seu plano.
              <Button variant="link" size="sm" asChild className="p-0 h-auto">
                <Link to="/subscription">Upgrade para Ilimitado</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.length === 0 ? (
            <div className="col-span-full text-center py-12 border rounded-xl bg-card text-muted-foreground">
              <Scissors size={48} className="mx-auto mb-4 opacity-20" />
              <p>Nenhum serviço cadastrado ainda.</p>
            </div>
          ) : (
            services.map((service) => (
              <div key={service.id} className="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg">{service.name}</h3>
                  <span className="font-bold text-primary">R$ {Number(service.price).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Clock size={16} />
                  <span>{service.duration_minutes} minutos</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{service.description || "Sem descrição."}</p>
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => toast.info("Edição em breve")}>Editar</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
