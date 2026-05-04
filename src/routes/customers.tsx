import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
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
import { UserPlus, Search, Phone, Gift, Clock, Scissors, User as UserIcon, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/customers")({
  component: CustomersComponent,
});

function CustomersComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", notes: "" });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCustomers();
      fetchShopProfile();
    }
  }, [user]);

  async function fetchShopProfile() {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) setShopProfile(data);
  }

  async function fetchCustomerHistory(customerId: string) {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("appointments")
      .select("*, services(name), barbers(name)")
      .eq("customer_id", customerId)
      .order("start_time", { ascending: false });
    
    if (data) setCustomerHistory(data);
    setLoadingHistory(false);
  }

  const handleViewHistory = (customer: any) => {
    setSelectedCustomer(customer);
    fetchCustomerHistory(customer.id);
    setIsHistoryOpen(true);
  };

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name");
    if (error) toast.error("Erro ao buscar clientes");
    else setCustomers(data || []);
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from("customers").insert({
      ...newCustomer,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erro ao adicionar cliente");
    } else {
      toast.success("Cliente adicionado com sucesso!");
      setIsAddDialogOpen(false);
      setNewCustomer({ name: "", phone: "", email: "", notes: "" });
      fetchCustomers();
    }
  }

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)
  );

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
            <p className="text-muted-foreground">Gerencie seus clientes e histórico.</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus size={18} /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddCustomer} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input 
                    id="name" 
                    value={newCustomer.name} 
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone / WhatsApp</Label>
                  <Input 
                    id="phone" 
                    placeholder="(00) 00000-0000"
                    value={newCustomer.phone} 
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Opcional)</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={newCustomer.email} 
                    onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas / Preferências</Label>
                  <Input 
                    id="notes" 
                    value={newCustomer.notes} 
                    onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})} 
                  />
                </div>
                <Button type="submit" className="w-full">Salvar Cliente</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Buscar por nome ou telefone..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="border rounded-xl bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="hidden md:table-cell">Fidelidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-muted-foreground" />
                        {customer.phone || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Gift size={14} className="text-primary" />
                        <span className="font-medium">{customer.loyalty_points || 0}</span>
                        <span className="text-muted-foreground text-xs">/ {shopProfile?.free_service_threshold || 10}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewHistory(customer)}>
                        Ver Histórico
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <HistoryDialog 
          isOpen={isHistoryOpen} 
          onOpenChange={setIsHistoryOpen}
          selectedCustomer={selectedCustomer}
          shopProfile={shopProfile}
          loadingHistory={loadingHistory}
          customerHistory={customerHistory}
        />
      </div>
    </AppLayout>
  );
}

