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
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Search, Phone, Gift, Clock, Scissors, User as UserIcon, CheckCircle2, Star, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", notes: "" });
  const [editingCustomer, setEditingCustomer] = useState({ id: "", name: "", phone: "", email: "", notes: "" });

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
      .select("*, services(name), barbers(name), service_ratings(rating, comment)")
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

  async function handleEditCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !editingCustomer.id) return;

    const { error } = await supabase
      .from("customers")
      .update({
        name: editingCustomer.name,
        phone: editingCustomer.phone,
        email: editingCustomer.email,
        notes: editingCustomer.notes,
      })
      .eq("id", editingCustomer.id);

    if (error) {
      toast.error("Erro ao atualizar cliente");
    } else {
      toast.success("Cliente atualizado com sucesso!");
      setIsEditDialogOpen(false);
      fetchCustomers();
    }
  }

  async function handleDeleteCustomer() {
    if (!selectedCustomer) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", selectedCustomer.id);

    if (error) {
      toast.error("Erro ao excluir cliente. Verifique se ele possui agendamentos vinculados.");
    } else {
      toast.success("Cliente excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      fetchCustomers();
    }
  }

  const openEditDialog = (customer: any) => {
    setEditingCustomer({
      id: customer.id,
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (customer: any) => {
    setSelectedCustomer(customer);
    setIsDeleteDialogOpen(true);
  };

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
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewHistory(customer)}>
                          Histórico
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(customer)}>
                          <Edit size={16} className="text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(customer)}>
                          <Trash2 size={16} className="text-destructive" />
                        </Button>
                      </div>
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

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditCustomer} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input 
                  id="edit-name" 
                  value={editingCustomer.name} 
                  onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone / WhatsApp</Label>
                <Input 
                  id="edit-phone" 
                  placeholder="(00) 00000-0000"
                  value={editingCustomer.phone} 
                  onChange={(e) => setEditingCustomer({...editingCustomer, phone: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email (Opcional)</Label>
                <Input 
                  id="edit-email" 
                  type="email"
                  value={editingCustomer.email} 
                  onChange={(e) => setEditingCustomer({...editingCustomer, email: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notas / Preferências</Label>
                <Input 
                  id="edit-notes" 
                  value={editingCustomer.notes} 
                  onChange={(e) => setEditingCustomer({...editingCustomer, notes: e.target.value})} 
                />
              </div>
              <Button type="submit" className="w-full">Atualizar Cliente</Button>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o cliente {selectedCustomer?.name}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

function HistoryDialog({ isOpen, onOpenChange, selectedCustomer, shopProfile, loadingHistory, customerHistory }: any) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de {selectedCustomer?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2 text-primary">
                <Gift size={18} />
                <span className="font-bold">Cartão Fidelidade</span>
              </div>
              <span className="text-sm font-medium">
                {selectedCustomer?.loyalty_points || 0} / {shopProfile?.free_service_threshold || 10}
              </span>
            </div>
            <Progress 
              value={((selectedCustomer?.loyalty_points || 0) % (shopProfile?.free_service_threshold || 10)) / (shopProfile?.free_service_threshold || 10) * 100} 
              className="h-2" 
            />
            <p className="text-xs text-muted-foreground mt-2">
              {selectedCustomer?.loyalty_points >= (shopProfile?.free_service_threshold || 10) 
                ? "Este cliente já possui serviços gratuitos acumulados!" 
                : `Faltam ${(shopProfile?.free_service_threshold || 10) - ((selectedCustomer?.loyalty_points || 0) % (shopProfile?.free_service_threshold || 10))} procedimentos para o próximo serviço gratuito.`}
            </p>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="text-center py-8">Carregando histórico...</div>
              ) : customerHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum agendamento encontrado.</div>
              ) : (
                customerHistory.map((app: any) => (
                  <div key={app.id} className="flex items-center justify-between p-4 border rounded-xl">
                    <div>
                      <p className="font-bold">{app.services?.name}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(app.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        <span className="flex items-center gap-1"><UserIcon size={12} /> {app.barbers?.name}</span>
                        {app.payment_method && (
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              {app.payment_method === 'pix' ? 'PIX' : 
                               app.payment_method === 'credits' ? 'Créditos' : 
                               app.payment_method === 'cashback' ? 'Cashback' : 'Na Barbearia'}
                            </Badge>
                          </span>
                        )}
                        {app.notes && app.notes.includes('Pagamento:') && (
                          <span className="text-[10px] text-primary font-medium">{app.notes}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={cn(
                        app.status === 'completed' ? 'bg-green-600 hover:bg-green-700 text-white' : 
                        app.status === 'scheduled' ? 'bg-secondary text-secondary-foreground' : 
                        'bg-destructive text-destructive-foreground'
                      )}>
                        {app.status === 'completed' ? 'Concluído' : app.status === 'scheduled' ? 'Agendado' : 'Cancelado'}
                      </Badge>
                      {app.service_ratings?.[0] && (
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star size={12} fill="currentColor" />
                          <span className="text-xs font-bold">{app.service_ratings[0].rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
