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
import { UserPlus, UserRound, Phone, Mail, AlertTriangle, Upload, Loader2, Star, Crown, Copy, Trash2, Clock, Pencil, BarChart3, RefreshCcw, Search, Filter } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/barbers")({
  component: BarbersComponent,
});

const DEFAULT_WORKING_HOURS = {
  monday: { enabled: true, start: "09:00", end: "19:00" },
  tuesday: { enabled: true, start: "09:00", end: "19:00" },
  wednesday: { enabled: true, start: "09:00", end: "19:00" },
  thursday: { enabled: true, start: "09:00", end: "19:00" },
  friday: { enabled: true, start: "09:00", end: "19:00" },
  saturday: { enabled: true, start: "09:00", end: "14:00" },
  sunday: { enabled: false, start: "09:00", end: "14:00" }
};

const DAY_LABELS: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo"
};

function BarbersComponent() {
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();
  const { plan, limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Delete Confirmation State
  const [barberToDelete, setBarberToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [newBarber, setNewBarber] = useState({ 
    name: "", 
    phone: "", 
    email: "", 
    avatar_url: "", 
    category: "Proprietário", 
    commission_rate: 0,
    working_hours: DEFAULT_WORKING_HOURS
  });
  const [uploading, setUploading] = useState(false);
  const canAddBarber = checkLimit("barbers");

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
      await Promise.all([fetchBarbers(), fetchServices()]);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchServices() {
    if (!user) return;
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("tenant_id", user.id)
      .eq("active", true)
      .order("name");
    if (error) throw error;
    else setServices(data || []);
  }

  async function fetchBarbers() {
    if (!user) return;
    const { data, error } = await supabase
      .from("barbers")
      .select(`
        *,
        barber_services(service_id),
        appointments:appointments(count)
      `)
      .eq("tenant_id", user.id)
      .order("name");
    
    if (error) {
      console.error(error);
      throw error;
    } else {
      setBarbers(data || []);
    }
  }

  async function handleToggleStatus(barber: any) {
    const { error } = await supabase
      .from("barbers")
      .update({ active: !barber.active })
      .eq("id", barber.id);

    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success("Status atualizado com sucesso!");
      fetchBarbers();
    }
  }

  async function handleDeleteBarber(id: string) {
    const { error } = await supabase
      .from("barbers")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir barbeiro");
    } else {
      toast.success("Barbeiro excluído com sucesso!");
      fetchBarbers();
      refreshLimits();
      setIsDeleteDialogOpen(false);
      setBarberToDelete(null);
    }
  }

  const filteredBarbers = useMemo(() => {
    return barbers.filter((barber) => {
      const matchesSearch = barber.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          barber.phone?.includes(searchQuery) ||
                          barber.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "active" && barber.active) ||
                          (statusFilter === "inactive" && !barber.active);
      
      const matchesCategory = categoryFilter === "all" || barber.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [barbers, searchQuery, statusFilter, categoryFilter]);

  async function handleAddBarber(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    console.log('--- START ADD BARBER ---');
    console.log('NEW BARBER DATA:', newBarber);
    console.log('SELECTED SERVICES:', selectedServices);

    const { data: barber, error: barberError } = await supabase.from("barbers").insert({
      ...newBarber,
      tenant_id: user.id,
      user_id: user.id,
      active: true,
    }).select().single();

    if (barberError) {
      console.error('INSERT BARBER ERROR:', barberError);
      toast.error(`Erro ao adicionar barbeiro: ${barberError.message}`);
      return;
    }

    console.log('BARBER CREATED SUCCESSFULLY:', barber);
    console.log('BARBER ID:', barber?.id);

    if (selectedServices.length > 0) {
      const servicesPayload = selectedServices.map(serviceId => ({
        barber_id: barber.id,
        service_id: serviceId,
        tenant_id: user.id,
        user_id: user.id
      }));

      console.log('SERVICES PAYLOAD:', servicesPayload);
      
      const { data: servicesResult, error: servicesError } = await supabase
        .from("barber_services")
        .insert(servicesPayload)
        .select();

      console.log('SERVICES INSERT RESULT:', servicesResult);

      if (servicesError) {
        console.error('INSERT SERVICES ERROR:', servicesError);
        toast.error(`Barbeiro criado, mas erro ao vincular serviços: ${servicesError.message}`);
      } else if (!servicesResult || servicesResult.length === 0) {
        console.error('INSERT SERVICES FAILED: No data returned');
        toast.error("Erro silencioso ao vincular serviços. Verifique os logs.");
      } else {
        console.log('SERVICES LINKED SUCCESSFULLY');
      }
    } else {
      console.warn('NO SERVICES SELECTED');
      toast.warning("Barbeiro criado sem serviços vinculados.");
    }

    toast.success("Barbeiro cadastrado com sucesso!");
    setIsAddDialogOpen(false);
    setNewBarber({ name: "", phone: "", email: "", avatar_url: "", category: "Proprietário", commission_rate: 0, working_hours: DEFAULT_WORKING_HOURS });
    setSelectedServices([]);
    
    // Invalidate Caches
    const queryClient = (window as any).queryClient;
    if (queryClient) {
      console.log('INVALIDATING QUERIES');
      queryClient.invalidateQueries({ queryKey: ["barbers"] });
      queryClient.invalidateQueries({ queryKey: ["barber-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    }

    fetchBarbers();
    refreshLimits();
    console.log('--- END ADD BARBER ---');
  }

  async function handleUpdateBarber(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBarber || !user) return;

    console.log('--- START UPDATE BARBER ---');
    console.log('UPDATING BARBER ID:', editingBarber.id);

    const payload = {
      name: editingBarber.name,
      phone: editingBarber.phone,
      email: editingBarber.email,
      avatar_url: editingBarber.avatar_url,
      category: editingBarber.category,
      commission_rate: editingBarber.commission_rate,
      working_hours: editingBarber.working_hours,
      active: editingBarber.active
    };

    console.log('UPDATE PAYLOAD:', payload);

    const { data: updateResult, error: updateError } = await supabase
      .from("barbers")
      .update(payload)
      .eq("id", editingBarber.id)
      .select();

    if (updateError) {
      console.error('UPDATE BARBER ERROR:', updateError);
      toast.error(`Erro ao atualizar barbeiro: ${updateError.message}`);
      return;
    }

    if (!updateResult || updateResult.length === 0) {
      console.error('UPDATE FAILED: No rows affected');
      toast.error("Erro ao salvar: O registro não foi encontrado ou não foi alterado.");
      return;
    }

    console.log('BARBER UPDATED SUCCESSFULLY:', updateResult);

    // Sync Services: Delete and Re-insert
    console.log('SYNCING SERVICES FOR BARBER:', editingBarber.id);
    console.log('SELECTED SERVICES:', selectedServices);

    const { error: deleteError } = await supabase
      .from("barber_services")
      .delete()
      .eq("barber_id", editingBarber.id);
    
    if (deleteError) {
      console.error('DELETE OLD SERVICES ERROR:', deleteError);
      toast.error(`Erro ao limpar serviços antigos: ${deleteError.message}`);
      // We continue to try inserting new ones even if delete failed (though it might cause duplicates if RLS is weird)
    } else {
      console.log('OLD SERVICES DELETED');
    }

    if (selectedServices.length > 0) {
      const servicesPayload = selectedServices.map(serviceId => ({
        barber_id: editingBarber.id,
        service_id: serviceId,
        tenant_id: user.id,
        user_id: user.id
      }));

      console.log('INSERTING SERVICES PAYLOAD:', servicesPayload);
      
      const { data: servicesResult, error: servicesError } = await supabase
        .from("barber_services")
        .insert(servicesPayload)
        .select();
      
      if (servicesError) {
        console.error('INSERT SERVICES ERROR:', servicesError);
        toast.error(`Barbeiro atualizado, mas erro ao vincular serviços: ${servicesError.message}`);
      } else if (!servicesResult || servicesResult.length === 0) {
        console.error('INSERT SERVICES FAILED: No data returned');
        toast.error("Erro silencioso ao vincular serviços. Verifique os logs.");
      } else {
        console.log('SERVICES LINKED SUCCESSFULLY:', servicesResult);
      }
    } else {
      console.warn("NO SERVICES SELECTED");
      toast.warning("O profissional ficou sem serviços vinculados.");
    }

    toast.success("Barbeiro atualizado com sucesso!");
    setIsEditDialogOpen(false);
    setEditingBarber(null);
    setSelectedServices([]);
    
    // Invalidate Caches
    const queryClient = (window as any).queryClient;
    if (queryClient) {
      console.log('INVALIDATING QUERIES');
      queryClient.invalidateQueries({ queryKey: ["barbers"] });
      queryClient.invalidateQueries({ queryKey: ["barber-services"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    }
    
    fetchBarbers();
    console.log('--- END UPDATE BARBER ---');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('barber-avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('barber-avatars')
        .getPublicUrl(filePath);

      if (isEdit) {
        setEditingBarber({ ...editingBarber, avatar_url: publicUrl });
      } else {
        setNewBarber({ ...newBarber, avatar_url: publicUrl });
      }
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao enviar imagem: " + error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDuplicateBarber(barber: any) {
    if (!user) return;
    
    if (usage.barbers >= limits.barbers) {
      toast.error(`Limite atingido! Seu plano permite apenas ${limits.barbers} profissionais.`);
      return;
    }

    const { data: newBarberData, error } = await supabase.from("barbers").insert({
      name: `${barber.name} (Cópia)`,
      phone: barber.phone,
      email: barber.email,
      avatar_url: barber.avatar_url,
      category: barber.category,
      commission_rate: barber.commission_rate,
      tenant_id: user.id,
      user_id: user.id,
    }).select().single();

    if (error) {
      toast.error("Erro ao duplicar barbeiro");
    } else {
      // Duplicate services if they exist
      if (barber.barber_services && barber.barber_services.length > 0) {
        const links = barber.barber_services.map((bs: any) => ({
          barber_id: newBarberData.id,
          service_id: bs.service_id,
          tenant_id: user.id,
          user_id: user.id
        }));
        await supabase.from("barber_services").insert(links);
      }

      toast.success("Barbeiro duplicado com sucesso!");
      fetchBarbers();
      refreshLimits();
    }
  }

  if (authLoading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Profissionais</h2>
              <p className="text-muted-foreground text-sm">Cadastre os barbeiros da sua equipe.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 h-4 w-4" />
                <Input
                  placeholder="Buscar profissional..."
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
                    <SelectItem value="Proprietário">Proprietário</SelectItem>
                    <SelectItem value="Freelancer">Freelancer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="gap-2 w-full xl:w-auto h-[48px] px-8 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] border-none shrink-0" 
                variant={canAddBarber ? "default" : "secondary"}
                onClick={() => {
                  setSelectedServices([]);
                  setIsAddDialogOpen(true);
                }}
              >
                <UserPlus size={20} /> Novo Barbeiro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto custom-scrollbar sm:max-w-[500px]">
              {canAddBarber ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Barbeiro</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    if (selectedServices.length === 0) {
                      e.preventDefault();
                      toast.error("Selecione pelo menos um serviço para o profissional.");
                      return;
                    }
                    handleAddBarber(e);
                  }} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="avatar">Foto do Profissional</Label>
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          {newBarber.avatar_url ? (
                            <img src={newBarber.avatar_url} alt="Preview" className="h-full w-full object-cover" />
                          ) : (
                            <AvatarFallback><Upload size={20} className="text-muted-foreground" /></AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1">
                          <Input 
                            id="avatar" 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, false)}
                            disabled={uploading}
                            className="cursor-pointer"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {uploading ? "Enviando..." : "Selecione uma imagem quadrada (JPG, PNG)"}
                          </p>
                        </div>
                      </div>
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
                    <div className="space-y-2">
                      <Label>Serviços Prestados</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                        {services.map(service => (
                          <div key={service.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`new-service-${service.id}`}
                              checked={selectedServices.includes(service.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedServices([...selectedServices, service.id]);
                                } else {
                                  setSelectedServices(selectedServices.filter(id => id !== service.id));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <label htmlFor={`new-service-${service.id}`} className="text-xs truncate">{service.name}</label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="flex items-center gap-2">
                        <Clock size={16} /> Horário de Trabalho
                      </Label>
                      <div className="space-y-3 p-3 border rounded-md">
                        {Object.entries(DAY_LABELS).map(([day, label]) => (
                          <div key={day} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Checkbox 
                                  id={`day-${day}`}
                                  checked={newBarber.working_hours[day as keyof typeof DEFAULT_WORKING_HOURS]?.enabled}
                                  onCheckedChange={(checked) => {
                                    setNewBarber({
                                      ...newBarber,
                                      working_hours: {
                                        ...newBarber.working_hours,
                                        [day]: {
                                          ...(newBarber.working_hours[day as keyof typeof DEFAULT_WORKING_HOURS] || DEFAULT_WORKING_HOURS[day as keyof typeof DEFAULT_WORKING_HOURS]),
                                          enabled: checked === true
                                        }
                                      }
                                    });
                                  }}
                                />
                                <Label htmlFor={`day-${day}`} className="text-sm font-medium">{label}</Label>
                              </div>
                              {newBarber.working_hours[day as keyof typeof DEFAULT_WORKING_HOURS]?.enabled && (
                                <div className="flex items-center gap-2">
                                  <Input 
                                    type="time" 
                                    className="h-8 w-24 text-xs"
                                    value={newBarber.working_hours[day as keyof typeof DEFAULT_WORKING_HOURS]?.start}
                                    onChange={(e) => {
                                      setNewBarber({
                                        ...newBarber,
                                        working_hours: {
                                          ...newBarber.working_hours,
                                          [day]: {
                                            ...newBarber.working_hours[day as keyof typeof DEFAULT_WORKING_HOURS],
                                            start: e.target.value
                                          }
                                        }
                                      });
                                    }}
                                  />
                                  <span className="text-xs text-muted-foreground">às</span>
                                  <Input 
                                    type="time" 
                                    className="h-8 w-24 text-xs"
                                    value={newBarber.working_hours[day as keyof typeof DEFAULT_WORKING_HOURS]?.end}
                                    onChange={(e) => {
                                      setNewBarber({
                                        ...newBarber,
                                        working_hours: {
                                          ...newBarber.working_hours,
                                          [day]: {
                                            ...newBarber.working_hours[day as keyof typeof DEFAULT_WORKING_HOURS],
                                            end: e.target.value
                                          }
                                        }
                                      });
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-black text-white hover:scale-105 transition-all h-12 rounded-xl font-bold uppercase tracking-tight">Salvar Barbeiro</Button>
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

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-6 border border-amber-500/10 rounded-[20px] bg-[#0b0f17] space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-20 w-20 rounded-full bg-slate-800" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-3/4 bg-slate-800" />
                    <Skeleton className="h-4 w-1/2 bg-slate-800" />
                  </div>
                </div>
                <div className="space-y-2 pt-4">
                  <Skeleton className="h-4 w-full bg-slate-800" />
                  <Skeleton className="h-4 w-full bg-slate-800" />
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
          ) : barbers.length === 0 ? (
            <div className="col-span-full text-center py-20 border border-dashed border-amber-500/20 rounded-[20px] bg-[#0b0f17] text-muted-foreground">
              <UserRound size={64} className="mx-auto mb-4 opacity-10 text-amber-500" />
              <p className="text-lg font-medium text-white/60">Nenhum profissional cadastrado ainda.</p>
              <p className="text-sm mt-1">Comece adicionando seu primeiro barbeiro.</p>
            </div>
          ) : (
            barbers.map((barber) => (
              <div 
                key={barber.id} 
                className="group relative p-6 border border-amber-500/20 rounded-[20px] bg-[#0b0f17] shadow-xl hover:border-amber-500/50 transition-all duration-500 hover:-translate-y-1 flex flex-col justify-between"
              >
                <div className="absolute top-4 right-4 z-10">
                  <Badge 
                    onClick={() => handleToggleStatus(barber)}
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      barber.active 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/20' 
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/20'
                    }`}
                  >
                    {barber.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>

                <div>
                  <div className="flex items-start gap-5 mb-6">
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-2 border-amber-500/30 ring-4 ring-amber-500/5 transition-transform duration-500 group-hover:scale-105">
                        {barber.avatar_url ? (
                          <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover" />
                        ) : (
                          <AvatarFallback className="bg-amber-500/10 text-amber-500 text-xl font-bold">
                            {typeof barber.name === 'string' ? barber.name.substring(0, 2).toUpperCase() : "??"}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-[#0b0f17] p-1 rounded-full">
                        <div className="flex items-center gap-1 bg-amber-500 px-1.5 py-0.5 rounded-full text-[10px] font-black text-black">
                          <Star size={10} fill="currentColor" />
                          {barber.average_rating || "5.0"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="font-bold text-xl text-white truncate group-hover:text-amber-400 transition-colors">{barber.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className={`text-[10px] font-bold tracking-wider uppercase py-0 ${
                          barber.category === 'Freelancer' 
                            ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' 
                            : 'border-purple-500/30 text-purple-400 bg-purple-500/5'
                        }`}>
                          {barber.category}
                        </Badge>
                        {barber.category === 'Freelancer' && (
                          <Badge variant="outline" className="text-[10px] font-bold tracking-wider uppercase py-0 border-orange-500/30 text-orange-400 bg-orange-500/5">
                            {barber.commission_rate}% Comis.
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-8 px-1">
                    <div className="flex items-center gap-3 text-white/60 text-sm hover:text-white transition-colors">
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <Phone size={14} className="text-amber-500/70" />
                      </div>
                      <span className="truncate">{barber.phone || "Não informado"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/60 text-sm hover:text-white transition-colors">
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <Mail size={14} className="text-amber-500/70" />
                      </div>
                      <span className="truncate">{barber.email || "Não informado"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/60 text-sm hover:text-white transition-colors">
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <BarChart3 size={14} className="text-amber-500/70" />
                      </div>
                      <span>{barber.appointments?.[0]?.count || 0} Atendimentos</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 h-10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-black transition-all duration-300 font-semibold"
                    onClick={() => toast.info("Relatório em breve")}
                  >
                    Desempenho
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 text-white/40 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                      onClick={() => {
                        setEditingBarber(barber);
                        setSelectedServices(barber.barber_services?.map((bs: any) => bs.service_id) || []);
                        setIsEditDialogOpen(true);
                      }}
                      title="Editar"
                    >
                      <Pencil size={18} />
                    </Button>
                    
                    {plan !== 'free' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-white/40 hover:text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all"
                        onClick={() => handleDuplicateBarber(barber)}
                        title="Duplicar"
                      >
                        <Copy size={18} />
                      </Button>
                    )}
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                      onClick={() => handleDeleteBarber(barber.id)}
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto custom-scrollbar sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Profissional</DialogTitle>
            </DialogHeader>
            {editingBarber && (
              <form onSubmit={(e) => {
                if (selectedServices.length === 0) {
                  e.preventDefault();
                  toast.error("Selecione pelo menos um serviço para o profissional.");
                  return;
                }
                handleUpdateBarber(e);
              }} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_avatar">Foto do Profissional</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      {editingBarber.avatar_url ? (
                        <img src={editingBarber.avatar_url} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <AvatarFallback><Upload size={20} className="text-muted-foreground" /></AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <Input 
                        id="edit_avatar" 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, true)}
                        disabled={uploading}
                        className="cursor-pointer"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {uploading ? "Enviando..." : "Selecione uma imagem quadrada (JPG, PNG)"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Nome do Profissional</Label>
                  <Input 
                    id="edit_name" 
                    placeholder="João Silva"
                    value={editingBarber.name} 
                    onChange={(e) => setEditingBarber({...editingBarber, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_category">Categoria</Label>
                    <Select 
                      value={editingBarber.category} 
                      onValueChange={(value) => setEditingBarber({
                        ...editingBarber, 
                        category: value,
                        commission_rate: value === 'Freelancer' ? (editingBarber.commission_rate || 50) : 0
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
                  {editingBarber.category === 'Freelancer' && (
                    <div className="space-y-2">
                      <Label htmlFor="edit_commission">Comissão (%)</Label>
                      <Input 
                        id="edit_commission" 
                        type="number"
                        value={editingBarber.commission_rate} 
                        onChange={(e) => setEditingBarber({...editingBarber, commission_rate: Number(e.target.value)})} 
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_phone">Telefone</Label>
                  <Input 
                    id="edit_phone" 
                    placeholder="(00) 00000-0000"
                    value={editingBarber.phone || ""} 
                    onChange={(e) => setEditingBarber({...editingBarber, phone: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_email">Email (Opcional)</Label>
                  <Input 
                    id="edit_email" 
                    type="email"
                    value={editingBarber.email || ""} 
                    onChange={(e) => setEditingBarber({...editingBarber, email: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Serviços Prestados</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                    {services.map(service => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`edit-service-${service.id}`}
                          checked={selectedServices.includes(service.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedServices([...selectedServices, service.id]);
                            } else {
                              setSelectedServices(selectedServices.filter(id => id !== service.id));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor={`edit-service-${service.id}`} className="text-xs truncate">{service.name}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    <Clock size={16} /> Horário de Trabalho
                  </Label>
                  <div className="space-y-3 p-3 border rounded-md">
                    {Object.entries(DAY_LABELS).map(([day, label]) => {
                      const dayConfig = (editingBarber.working_hours?.[day]) || DEFAULT_WORKING_HOURS[day as keyof typeof DEFAULT_WORKING_HOURS];
                      return (
                        <div key={day} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                id={`edit-day-${day}`}
                                checked={dayConfig.enabled}
                                onCheckedChange={(checked) => {
                                  setEditingBarber({
                                    ...editingBarber,
                                    working_hours: {
                                      ...(editingBarber.working_hours || DEFAULT_WORKING_HOURS),
                                      [day]: {
                                        ...dayConfig,
                                        enabled: checked === true
                                      }
                                    }
                                  });
                                }}
                              />
                              <Label htmlFor={`edit-day-${day}`} className="text-sm font-medium">{label}</Label>
                            </div>
                            {dayConfig.enabled && (
                              <div className="flex items-center gap-2">
                                <Input 
                                  type="time" 
                                  className="h-8 w-24 text-xs"
                                  value={dayConfig.start}
                                  onChange={(e) => {
                                    setEditingBarber({
                                      ...editingBarber,
                                      working_hours: {
                                        ...(editingBarber.working_hours || DEFAULT_WORKING_HOURS),
                                        [day]: {
                                          ...dayConfig,
                                          start: e.target.value
                                        }
                                      }
                                    });
                                  }}
                                />
                                <span className="text-xs text-muted-foreground">às</span>
                                <Input 
                                  type="time" 
                                  className="h-8 w-24 text-xs"
                                  value={dayConfig.end}
                                  onChange={(e) => {
                                    setEditingBarber({
                                      ...editingBarber,
                                      working_hours: {
                                        ...(editingBarber.working_hours || DEFAULT_WORKING_HOURS),
                                        [day]: {
                                          ...dayConfig,
                                          end: e.target.value
                                        }
                                      }
                                    });
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button type="submit" className="w-full bg-black text-white hover:scale-105 transition-all h-12 rounded-xl font-bold uppercase tracking-tight">Salvar Alterações</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

