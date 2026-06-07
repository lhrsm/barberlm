import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Scissors, Plus, Clock, AlertTriangle, Crown, Edit2, Trash2, Copy, Search, Filter, Loader2, UserRound, RefreshCcw, MoreHorizontal, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/services")({
  component: ServicesComponent,
});

function ServicesComponent() {
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();
  const { limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  
  const [serviceToDelete, setServiceToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  const [newService, setNewService] = useState({ 
    name: "", 
    price: "", 
    duration_minutes: "30", 
    description: "",
    category: "Geral"
  });

  const canAddService = checkLimit("services");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
      return;
    }

    if (!authLoading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role !== 'super_admin') {
      fetchData();
    }
  }, [user, role]);

  async function fetchData() {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchServices(), fetchBarbers()]);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchBarbers() {
    if (!user) return;
    const { data, error } = await supabase
      .from("barbers")
      .select("id, name, avatar_url")
      .eq("tenant_id", user.id);
    if (error) throw error;
    setBarbers(data || []);
  }

  async function fetchServices() {
    if (!user) return;
    const { data, error } = await supabase
      .from("services")
      .select(`
        *,
        barber_services(
          barber_id,
          barbers(id, name, avatar_url)
        )
      `)
      .eq("tenant_id", user.id)
      .order("name");
    
    if (error) {
      console.error(error);
      throw error;
    } else {
      setServices(data || []);
    }
  }

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch = service.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          service.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "active" && service.active) ||
                          (statusFilter === "inactive" && !service.active);
      
      const matchesCategory = categoryFilter === "all" || service.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [services, searchQuery, statusFilter, categoryFilter]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(services.map(s => s.category).filter(Boolean)));
    return uniqueCategories.length > 0 ? uniqueCategories : ["Geral"];
  }, [services]);

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from("services").insert({
      ...newService,
      price: parseFloat(newService.price),
      duration_minutes: parseInt(newService.duration_minutes),
      tenant_id: user.id,
      user_id: user.id,
      active: true
    });

    if (error) {
      toast.error("Erro ao adicionar serviço");
    } else {
      toast.success("Serviço adicionado com sucesso!");
      setIsAddDialogOpen(false);
      setNewService({ name: "", price: "", duration_minutes: "30", description: "", category: "Geral" });
      fetchServices();
      refreshLimits();
    }
  }

  async function handleUpdateService(e: React.FormEvent) {
    e.preventDefault();
    if (!editingService || !user) return;

    const { error } = await supabase
      .from("services")
      .update({
        name: editingService.name,
        price: parseFloat(editingService.price),
        duration_minutes: parseInt(editingService.duration_minutes),
        description: editingService.description,
        category: editingService.category,
        active: editingService.active
      })
      .eq("id", editingService.id);

    if (error) {
      toast.error("Erro ao atualizar serviço");
    } else {
      toast.success("Serviço atualizado com sucesso!");
      setIsEditDialogOpen(false);
      setEditingService(null);
      fetchServices();
    }
  }

  async function handleDeleteService(id: string) {
    if (!user) return;

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir serviço");
    } else {
      toast.success("Serviço excluído com sucesso!");
      fetchServices();
      refreshLimits();
      setIsDeleteDialogOpen(false);
      setServiceToDelete(null);
    }
  }

  async function handleDuplicateService(service: any) {
    if (!user) return;
    
    if (usage.services >= limits.services) {
      toast.error(`Limite atingido! Seu plano permite apenas ${limits.services} serviços.`);
      return;
    }

    const { id, created_at, barber_services, ...serviceToCopy } = service;
    const { error } = await supabase.from("services").insert({
      ...serviceToCopy,
      name: `${service.name} (Cópia)`,
      tenant_id: user.id,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erro ao duplicar serviço");
    } else {
      toast.success("Serviço duplicado com sucesso!");
      fetchServices();
      refreshLimits();
    }
  }

  async function handleToggleStatus(service: any) {
    const { error } = await supabase
      .from("services")
      .update({ active: !service.active })
      .eq("id", service.id);

    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success("Status atualizado com sucesso!");
      fetchServices();
    }
  }

  if (authLoading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Serviços</h2>
              <p className="text-muted-foreground text-sm">Gerencie os serviços e valores da sua barbearia.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 h-4 w-4" />
                <Input
                  placeholder="Buscar serviço..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#0b0f17] border-amber-500/10 focus:border-amber-500/30 text-white h-11 rounded-xl"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px] bg-[#0b0f17] border-amber-500/10 text-white h-11 rounded-xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f17] border-amber-500/10 text-white">
                    <SelectItem value="all">Todos Status</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] bg-[#0b0f17] border-amber-500/10 text-white h-11 rounded-xl">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f17] border-amber-500/10 text-white">
                    <SelectItem value="all">Categorias</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            disabled={!canAddService}
            className="h-11 px-6 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-amber-500/20 gap-2 w-full xl:w-auto"
          >
            <Plus className="h-4 w-4" />
            Novo Serviço
          </Button>
        </div>

        {!canAddService && (
          <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500">
            <Crown className="h-4 w-4" />
            <AlertTitle>Limite Atingido</AlertTitle>
            <AlertDescription className="flex items-center justify-between w-full">
              <span>Seu plano permite apenas {limits.services} serviços.</span>
              <Button variant="link" size="sm" asChild className="text-amber-500 p-0 h-auto">
                <Link to="/subscription">Fazer Upgrade</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-6 border border-amber-500/10 rounded-[20px] bg-[#0b0f17] space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-1/2 bg-slate-800" />
                  <Skeleton className="h-6 w-1/4 bg-slate-800" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full bg-slate-800" />
                  <Skeleton className="h-4 w-3/4 bg-slate-800" />
                </div>
                <div className="flex gap-2 pt-4">
                  <Skeleton className="h-8 w-20 bg-slate-800" />
                  <Skeleton className="h-8 w-20 bg-slate-800" />
                </div>
                <div className="flex gap-2 pt-4">
                  <Skeleton className="h-10 flex-1 bg-slate-800" />
                  <Skeleton className="h-10 w-10 bg-slate-800" />
                  <Skeleton className="h-10 w-10 bg-slate-800" />
                </div>
              </div>
            ))
          ) : error ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 border border-dashed border-red-500/20 rounded-[20px] bg-[#0b0f17] text-center">
              <AlertTriangle size={48} className="text-red-500 mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-white mb-2">Ops! Algo deu errado</h3>
              <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
              <Button onClick={() => fetchData()} variant="outline" className="gap-2 border-amber-500/20 hover:bg-amber-500/10 text-amber-500">
                <RefreshCcw size={16} /> Tentar novamente
              </Button>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="col-span-full text-center py-20 border border-dashed border-amber-500/20 rounded-[20px] bg-[#0b0f17] text-muted-foreground">
              <Scissors size={64} className="mx-auto mb-4 opacity-10 text-amber-500" />
              <p className="text-lg font-medium text-white/60">Nenhum serviço encontrado.</p>
              <p className="text-sm mt-1">Clique em "Novo Serviço" para começar.</p>
            </div>
          ) : (
            filteredServices.map((service) => (
              <div 
                key={service.id} 
                className="group relative p-6 border border-amber-500/20 rounded-[20px] bg-[#0b0f17] shadow-xl hover:border-amber-500/50 transition-all duration-500 hover:-translate-y-1 flex flex-col justify-between"
              >
                <div className="absolute top-4 right-4 z-10">
                  <Badge 
                    onClick={() => handleToggleStatus(service)}
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      service.active 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/20' 
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/20'
                    }`}
                  >
                    {service.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>

                <div>
                  <div className="mb-4">
                    <h3 className="font-bold text-xl text-white group-hover:text-amber-400 transition-colors line-clamp-1">{service.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-black text-amber-500">R$ {Number(service.price).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline" className="bg-amber-500/5 border-amber-500/20 text-amber-500/80 text-[10px] font-bold py-0 gap-1">
                      <Clock size={10} /> {service.duration_minutes} min
                    </Badge>
                    <Badge variant="outline" className="bg-blue-500/5 border-blue-500/20 text-blue-400 text-[10px] font-bold py-0">
                      {service.category || "Geral"}
                    </Badge>
                  </div>

                  <p className="text-sm text-white/50 mb-6 line-clamp-2 min-h-[40px]">
                    {service.description || "Sem descrição disponível."}
                  </p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-xs text-white/40 mb-2">
                      <span className="flex items-center gap-1.5"><Users size={12} /> Profissionais Vinculados</span>
                      <span className="font-bold text-white/60">{service.barber_services?.length || 0}</span>
                    </div>
                    <div className="flex -space-x-2 overflow-hidden">
                      {service.barber_services && service.barber_services.length > 0 ? (
                        service.barber_services.slice(0, 5).map((bs: any, idx: number) => (
                          <TooltipProvider key={idx}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-[#0b0f17] border border-amber-500/20">
                                  {bs.barbers?.avatar_url ? (
                                    <img src={bs.barbers.avatar_url} alt={bs.barbers.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <AvatarFallback className="bg-slate-800 text-[10px] text-amber-500 font-bold">
                                      {bs.barbers?.name?.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{bs.barbers?.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))
                      ) : (
                        <span className="text-[10px] text-white/30 italic">Nenhum profissional vinculado</span>
                      )}
                      {service.barber_services && service.barber_services.length > 5 && (
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 ring-2 ring-[#0b0f17] text-[10px] text-white/40 font-bold">
                          +{service.barber_services.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 h-10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-black transition-all duration-300 font-semibold gap-2"
                          onClick={() => {
                            // Logic to view professionals could be here or handled elsewhere
                            toast.info(`Profissionais: ${service.barber_services?.map((bs: any) => bs.barbers?.name).join(', ') || 'Nenhum'}`);
                          }}
                        >
                          <Users size={14} /> Profissionais
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ver lista completa de profissionais que realizam este serviço</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-white/40 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                            onClick={() => {
                              setEditingService(service);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit2 size={18} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Editar informações do serviço</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-white/40 hover:text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all"
                            onClick={() => handleDuplicateService(service)}
                          >
                            <Copy size={18} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Duplicar este serviço</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                            onClick={() => {
                              setServiceToDelete(service);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 size={18} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Excluir serviço permanentemente</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="bg-[#0b0f17] border-amber-500/20 text-white sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Novo Serviço</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddService} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Serviço</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: Corte Degradê"
                  value={newService.name} 
                  onChange={(e) => setNewService({...newService, name: e.target.value})} 
                  className="bg-[#161b22] border-white/10 h-11"
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
                    className="bg-[#161b22] border-white/10 h-11"
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
                    className="bg-[#161b22] border-white/10 h-11"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input 
                  id="category" 
                  placeholder="Ex: Cabelo, Barba"
                  value={newService.category} 
                  onChange={(e) => setNewService({...newService, category: e.target.value})} 
                  className="bg-[#161b22] border-white/10 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (Opcional)</Label>
                <Input 
                  id="description" 
                  value={newService.description} 
                  onChange={(e) => setNewService({...newService, description: e.target.value})} 
                  className="bg-[#161b22] border-white/10 h-11"
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 rounded-xl">Salvar Serviço</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-[#0b0f17] border-amber-500/20 text-white sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Editar Serviço</DialogTitle>
            </DialogHeader>
            {editingService && (
              <form onSubmit={handleUpdateService} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome do Serviço</Label>
                  <Input 
                    id="edit-name" 
                    value={editingService.name} 
                    onChange={(e) => setEditingService({...editingService, name: e.target.value})} 
                    className="bg-[#161b22] border-white/10 h-11"
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">Preço (R$)</Label>
                    <Input 
                      id="edit-price" 
                      type="number"
                      step="0.01"
                      value={editingService.price} 
                      onChange={(e) => setEditingService({...editingService, price: e.target.value})} 
                      className="bg-[#161b22] border-white/10 h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-duration">Duração (min)</Label>
                    <Input 
                      id="edit-duration" 
                      type="number"
                      value={editingService.duration_minutes} 
                      onChange={(e) => setEditingService({...editingService, duration_minutes: e.target.value})} 
                      className="bg-[#161b22] border-white/10 h-11"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Categoria</Label>
                  <Input 
                    id="edit-category" 
                    value={editingService.category} 
                    onChange={(e) => setEditingService({...editingService, category: e.target.value})} 
                    className="bg-[#161b22] border-white/10 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Input 
                    id="edit-description" 
                    value={editingService.description || ""} 
                    onChange={(e) => setEditingService({...editingService, description: e.target.value})} 
                    className="bg-[#161b22] border-white/10 h-11"
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 rounded-xl">Salvar Alterações</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="bg-[#0b0f17] border-amber-500/20 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription className="text-white/60">
                Tem certeza que deseja excluir o serviço <span className="text-white font-bold">"{serviceToDelete?.name}"</span>?
                Esta ação não poderá ser desfeita e removerá o serviço de todos os profissionais vinculados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5">Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => serviceToDelete && handleDeleteService(serviceToDelete.id)}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
