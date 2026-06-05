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
import { UserPlus, Search, Phone, Gift, Clock, Scissors, User as UserIcon, CheckCircle2, Star, Edit, Trash2, CircleDollarSign, History as HistoryIcon, Mail, Cake } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/customers")({
  component: CustomersComponent,
});

function CustomersComponent() {
  const { user, loading, role } = useAuth();
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
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", notes: "", birth_date: "" });
  const [editingCustomer, setEditingCustomer] = useState({ id: "", name: "", phone: "", email: "", notes: "", birth_date: "" });

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
    if (user && role !== 'super_admin') {
      fetchCustomers();
      fetchShopProfile();
    }
  }, [user, role]);

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
    if (!user) return;
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", user.id)
      .order("name");
    if (error) toast.error("Erro ao buscar clientes");
    else setCustomers(data || []);
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from("customers").insert({
      ...newCustomer,
      tenant_id: user.id,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erro ao adicionar cliente");
    } else {
      toast.success("Cliente adicionado com sucesso!");
      setIsAddDialogOpen(false);
      setNewCustomer({ name: "", phone: "", email: "", notes: "", birth_date: "" });
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
        birth_date: editingCustomer.birth_date || null,
      })
      .eq("id", editingCustomer.id)
      .eq("tenant_id", user.id);

    if (error) {
      toast.error("Erro ao atualizar cliente");
    } else {
      toast.success("Cliente atualizado com sucesso!");
      setIsEditDialogOpen(false);
      fetchCustomers();
    }
  }

  async function handleDeleteCustomer() {
    if (!selectedCustomer || !user) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", selectedCustomer.id)
      .eq("tenant_id", user.id);

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
      birth_date: customer.birth_date || "",
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
            <h2 className="text-3xl font-bold tracking-tight text-white">Clientes</h2>
            <p className="text-slate-400 text-sm">Gerencie seus clientes e histórico.</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#D4AF37] hover:bg-[#C5A028] text-black font-semibold gap-2 shadow-lg hover:shadow-orange-500/20 transition-all rounded-xl w-full md:w-auto">
                <UserPlus size={18} /> + Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0b0f17] border-[#1f2937] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Adicionar Novo Cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddCustomer} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Nome Completo</Label>
                  <Input 
                    id="name" 
                    className="bg-[#111827] border-[#1f2937] text-white"
                    value={newCustomer.name} 
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-300">Telefone / WhatsApp</Label>
                  <Input 
                    id="phone" 
                    className="bg-[#111827] border-[#1f2937] text-white"
                    placeholder="(00) 00000-0000"
                    value={newCustomer.phone} 
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} 
                  />
                </div>
                <Button type="submit" className="w-full bg-[#D4AF37] text-black font-bold hover:bg-[#C5A028]">Salvar Cliente</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-[#0b0f17] border border-[#D4AF37]/20 shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-slate-400 text-xs uppercase font-bold">Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-black text-white">{customers.length}</p></CardContent>
          </Card>
          <Card className="bg-[#0b0f17] border border-[#D4AF37]/20 shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-slate-400 text-xs uppercase font-bold">Ativos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-black text-white">{customers.filter(c => c.id).length}</p></CardContent>
          </Card>
          <Card className="bg-[#0b0f17] border border-[#D4AF37]/20 shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-slate-400 text-xs uppercase font-bold">Créditos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-black text-green-500">R$ {customers.reduce((acc, c) => acc + (Number(c.credits) || 0), 0).toFixed(2)}</p></CardContent>
          </Card>
          <Card className="bg-[#0b0f17] border border-[#D4AF37]/20 shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-slate-400 text-xs uppercase font-bold">Cashback</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-black text-[#D4AF37]">R$ {customers.reduce((acc, c) => acc + (Number(c.cashback_balance) || 0), 0).toFixed(2)}</p></CardContent>
          </Card>
          <Card className="bg-[#0b0f17] border border-[#D4AF37]/20 shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-slate-400 text-xs uppercase font-bold">Aniversários</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-black text-white">0</p></CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <Input 
            placeholder="Buscar por nome, telefone ou CPF..." 
            className="pl-10 bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#D4AF37]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-[#0b0f17] border border-[#1f2937] rounded-2xl overflow-hidden shadow-xl">
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#111827]">
                <TableRow className="border-[#1f2937] hover:bg-transparent">
                  <TableHead className="text-slate-400 text-[10px] font-bold uppercase">Cliente</TableHead>
                  <TableHead className="text-slate-400 text-[10px] font-bold uppercase">Telefone</TableHead>
                  <TableHead className="text-slate-400 text-[10px] font-bold uppercase">Fidelidade</TableHead>
                  <TableHead className="text-slate-400 text-[10px] font-bold uppercase">Créditos</TableHead>
                  <TableHead className="text-slate-400 text-[10px] font-bold uppercase">Cashback</TableHead>
                  <TableHead className="text-slate-400 text-[10px] font-bold uppercase">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow className="hover:bg-transparent border-transparent">
                  <TableCell colSpan={6} className="text-center py-12 text-slate-500">Nenhum cliente encontrado.</TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="border-[#1f2937] hover:bg-[#111827]">
                    <TableCell className="font-bold text-white">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-white border border-slate-700">
                          {customer.name[0].toUpperCase()}
                        </div>
                        {customer.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{customer.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">
                        {customer.loyalty_points || 0} / {shopProfile?.free_service_threshold || 10}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-500 font-bold">R$ {(Number(customer.credits) || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-[#D4AF37] font-bold">R$ {(Number(customer.cashback_balance) || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-bold h-8 text-xs" onClick={() => handleViewHistory(customer)}>Ver</Button>
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white h-8" onClick={() => openEditDialog(customer)}><Edit size={14} /></Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400 h-8" onClick={() => openDeleteDialog(customer)}><Trash2 size={14} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          <div className="md:hidden divide-y divide-[#1f2937]">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-white text-lg">{customer.name}</p>
                  <Button variant="outline" size="sm" className="border-[#D4AF37] text-[#D4AF37] h-8 text-xs" onClick={() => handleViewHistory(customer)}>Ver</Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-slate-400">Tel: <span className="text-white">{customer.phone || "-"}</span></p>
                  <p className="text-slate-400">Créditos: <span className="text-green-500">R$ {(Number(customer.credits) || 0).toFixed(2)}</span></p>
                  <p className="text-slate-400">Cashback: <span className="text-[#D4AF37]">R$ {(Number(customer.cashback_balance) || 0).toFixed(2)}</span></p>
                </div>
              </div>
            ))}
          </div>
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
                <Label htmlFor="edit-birth_date">Data de Nascimento</Label>
                <Input 
                  id="edit-birth_date" 
                  type="date"
                  value={editingCustomer.birth_date} 
                  onChange={(e) => setEditingCustomer({...editingCustomer, birth_date: e.target.value})} 
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
          <AlertDialogContent className="bg-[#0b0f17] border-[#1f2937] text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Excluir Cliente</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Tem certeza que deseja excluir o cliente <span className="text-white font-bold">{selectedCustomer?.name}</span>? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-[#1f2937] text-white hover:bg-[#111827]">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCustomer} className="bg-red-600 text-white hover:bg-red-700">
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
  const handleWhatsApp = (phone: string) => {
    if (!phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${cleanPhone}`, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col bg-[#0b0f17] border-[#1f2937] text-white">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pr-6 border-b border-[#1f2937] pb-4">
          <DialogTitle className="text-white text-xl">Informações de {selectedCustomer?.name}</DialogTitle>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-green-600 hover:bg-green-700 text-white gap-2 border-none shadow-lg shadow-green-900/20"
            onClick={() => handleWhatsApp(selectedCustomer?.phone)}
          >
            <Phone size={14} /> WhatsApp
          </Button>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
          <div className="space-y-4">
            <div className="bg-[#111827] p-4 rounded-xl border border-[#1f2937] space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#1f2937] flex items-center justify-center text-white border border-[#D4AF37]/30">
                  <UserIcon size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Nome</p>
                  <p className="font-bold text-white">{selectedCustomer?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#1f2937] flex items-center justify-center text-white border border-[#D4AF37]/30">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Telefone</p>
                  <p className="text-white">{selectedCustomer?.phone || "Não informado"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#1f2937] flex items-center justify-center text-white border border-[#D4AF37]/30">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Email</p>
                  <p className="text-white truncate max-w-[180px]">{selectedCustomer?.email || "Não informado"}</p>
                </div>
              </div>
            </div>

            {selectedCustomer?.notes && (
              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 text-xs text-blue-200 italic">
                "{selectedCustomer.notes}"
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-[#111827] p-5 rounded-xl border border-[#D4AF37]/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Gift size={60} className="text-[#D4AF37]" />
              </div>
              
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2 text-[#D4AF37]">
                  <Gift size={20} />
                  <span className="font-bold uppercase text-xs tracking-widest">Fidelidade</span>
                </div>
                <span className="text-sm font-black text-white">
                  {selectedCustomer?.loyalty_points || 0} / {shopProfile?.free_service_threshold || 10}
                </span>
              </div>
              
              <div className="h-2 bg-[#1f2937] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#D4AF37] to-orange-500 transition-all duration-500"
                  style={{ width: `${Math.min(((selectedCustomer?.loyalty_points || 0) / (shopProfile?.free_service_threshold || 10)) * 100, 100)}%` }}
                />
              </div>

              <div className="mt-6 pt-4 border-t border-[#1f2937] grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Créditos</p>
                  <p className="text-lg font-black text-green-500">R$ {(Number(selectedCustomer?.credits) || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Cashback</p>
                  <p className="text-lg font-black text-[#D4AF37]">R$ {(Number(selectedCustomer?.cashback_balance) || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 space-y-4 border-t border-[#1f2937] pt-4">
          <div className="flex items-center gap-2">
            <HistoryIcon size={18} className="text-slate-400" />
            <h4 className="font-bold text-white uppercase text-xs tracking-wider">Histórico de Atendimentos</h4>
          </div>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="text-center py-12 text-slate-500 animate-pulse">Carregando histórico...</div>
              ) : customerHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic">Nenhum agendamento encontrado.</div>
              ) : (
                customerHistory.map((app: any) => (
                  <div key={app.id} className="flex items-center justify-between p-4 bg-[#111827] border border-[#1f2937] rounded-xl hover:border-[#D4AF37]/30 transition-all group">
                    <div>
                      <p className="font-bold text-white group-hover:text-[#D4AF37] transition-colors">{app.services?.name}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(app.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        <span className="flex items-center gap-1"><UserIcon size={12} /> {app.barbers?.name}</span>
                        {app.payment_method && (
                          <Badge variant="outline" className="text-[9px] py-0 h-4 uppercase border-slate-700 text-slate-500 bg-[#0b0f17]">
                            {app.payment_method === 'pix' ? 'PIX' : 
                             app.payment_method === 'credits' ? 'Créditos' : 
                             app.payment_method === 'cashback' ? 'Cashback' : 'Na Barbearia'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={cn(
                        "text-[10px] uppercase font-bold border-none",
                        app.status === 'completed' ? 'bg-green-500/10 text-green-500' : 
                        app.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500' : 
                        'bg-red-500/10 text-red-500'
                      )}>
                        {app.status === 'completed' ? 'Concluído' : app.status === 'scheduled' ? 'Agendado' : 'Cancelado'}
                      </Badge>
                      {app.service_ratings?.[0] && (
                        <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/5 px-2 py-0.5 rounded-full border border-yellow-500/10">
                          <Star size={10} fill="currentColor" />
                          <span className="text-[10px] font-black">{app.service_ratings[0].rating}</span>
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
