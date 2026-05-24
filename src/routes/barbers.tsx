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
import { UserPlus, UserRound, Phone, Mail, AlertTriangle, Upload, Loader2, Star, Crown, Copy, Trash2, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

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
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const { plan, limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<any>(null);
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
      fetchBarbers();
      fetchServices();
    }
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

  async function fetchBarbers() {
    if (!user) return;
    const { data, error } = await supabase
      .from("barbers")
      .select(`
        *,
        barber_services(service_id)
      `)
      .eq("user_id", user.id)
      .order("name");
    
    if (error) {
      console.error(error);
      toast.error("Erro ao buscar barbeiros");
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
    if (!confirm("Tem certeza que deseja excluir este profissional? Esta ação não pode ser desfeita.")) return;

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
    }
  }

  async function handleAddBarber(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { data: barber, error } = await supabase.from("barbers").insert({
      ...newBarber,
      user_id: user.id,
      active: true,
    }).select().single();

    if (error) {
      toast.error("Erro ao adicionar barbeiro");
    } else {
      // Add links to services
      if (selectedServices.length > 0) {
        const links = selectedServices.map(serviceId => ({
          barber_id: barber.id,
          service_id: serviceId,
          user_id: user.id
        }));
        await supabase.from("barber_services").insert(links);
      }

      toast.success("Barbeiro cadastrado com sucesso!");
      setIsAddDialogOpen(false);
      setNewBarber({ name: "", phone: "", email: "", avatar_url: "", category: "Proprietário", commission_rate: 0, working_hours: DEFAULT_WORKING_HOURS });
      setSelectedServices([]);
      fetchBarbers();
      refreshLimits();
    }
  }

  async function handleUpdateBarber(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBarber || !user) return;

    const { error } = await supabase
      .from("barbers")
      .update({
        name: editingBarber.name,
        phone: editingBarber.phone,
        email: editingBarber.email,
        avatar_url: editingBarber.avatar_url,
        category: editingBarber.category,
        commission_rate: editingBarber.commission_rate,
        working_hours: editingBarber.working_hours,
      })
      .eq("id", editingBarber.id);

    if (error) {
      toast.error("Erro ao atualizar barbeiro");
    } else {
      // Update services: delete existing and insert new
      await supabase.from("barber_services").delete().eq("barber_id", editingBarber.id);
      
      if (selectedServices.length > 0) {
        const links = selectedServices.map(serviceId => ({
          barber_id: editingBarber.id,
          service_id: serviceId,
          user_id: user.id
        }));
        await supabase.from("barber_services").insert(links);
      }

      toast.success("Barbeiro atualizado com sucesso!");
      setIsEditDialogOpen(false);
      setEditingBarber(null);
      setSelectedServices([]);
      fetchBarbers();
    }
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
          user_id: user.id
        }));
        await supabase.from("barber_services").insert(links);
      }

      toast.success("Barbeiro duplicado com sucesso!");
      fetchBarbers();
      refreshLimits();
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
              <Button 
                className="gap-2" 
                variant={canAddBarber ? "default" : "secondary"}
                onClick={() => {
                  setSelectedServices([]);
                  setIsAddDialogOpen(true);
                }}
              >
                <UserPlus size={18} /> Novo Barbeiro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto custom-scrollbar sm:max-w-[500px]">
              {canAddBarber ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Barbeiro</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddBarber} className="space-y-4 pt-4">
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
              <div key={barber.id} className="p-6 border-2 border-slate-200 rounded-xl bg-white shadow-sm hover:border-slate-300 transition-all duration-300">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-12 w-12">
                    {barber.avatar_url ? (
                      <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {typeof barber.name === 'string' ? barber.name.substring(0, 2).toUpperCase() : "??"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-slate-900">{barber.name}</h3>
                      <button 
                        onClick={() => handleToggleStatus(barber)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                          barber.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {barber.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 mb-1">
                      <Star size={12} className="text-yellow-500" fill="currentColor" />
                      <span className="text-xs font-bold">{barber.average_rating || "5.0"}</span>
                      <span className="text-[10px] text-slate-500">({barber.total_ratings || 0})</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        barber.category === 'Freelancer' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'
                      }`}>
                        {barber.category}
                      </span>
                      {barber.category === 'Freelancer' && (
                        <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium border border-orange-100">
                          {barber.commission_rate}% Comissão
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-slate-400" />
                    <span>{barber.phone || "Não informado"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-slate-400" />
                    <span>{barber.email || "Não informado"}</span>
                  </div>
                </div>
                <div className="mt-6 flex gap-2 items-center">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.info("Relatório em breve")}>Desempenho</Button>
                  {plan !== 'free' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleDuplicateBarber(barber)}
                    >
                      <Copy size={14} />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setEditingBarber(barber);
                      setSelectedServices(barber.barber_services?.map((bs: any) => bs.service_id) || []);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteBarber(barber.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
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
              <form onSubmit={handleUpdateBarber} className="space-y-4 pt-4">
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

                <Button type="submit" className="w-full">Salvar Alterações</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

