import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, CircleDollarSign, Clock, Users, Scissors, TrendingUp, Edit2, 
  User as UserIcon, LogOut, RefreshCcw, CheckCircle2, Phone, Mail, UserCheck, X
} from "lucide-react";
import { format, startOfDay, endOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchBarberStats } from "@/hooks/use-barber-stats";
import { EditProfileDialog } from "@/components/professional/EditProfileDialog";
import { EditScheduleDialog } from "@/components/professional/EditScheduleDialog";
import { CancelAppointmentDialog } from "@/components/professional/CancelAppointmentDialog";
import { ProfessionalNotifications } from "@/components/professional/ProfessionalNotifications";

export const Route = createFileRoute("/$slug/profissional")({
  component: ProfessionalDashboard,
});

function ProfessionalDashboard() {
  const { session, loading, logout } = useProfessionalAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barber, setBarber] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  
  // Dialog States
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState(false);
function ProfessionalDashboard() {
  const { session, loading, logout } = useProfessionalAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barber, setBarber] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  
  // Dialog States
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [session, loading, navigate]);

  const fetchData = async () => {
    if (!session?.barber_id) return;
    
    // Stats
    const statsData = await fetchBarberStats(session.barber_id);
    setStats(statsData);

    // Profile
    const { data: bData } = await supabase
      .from("barbers")
      .select("*")
      .eq("id", session.barber_id)
      .single();
    setBarber(bData);

    // Appointments
    const { data: allApps } = await supabase
      .from("appointments")
      .select("*, customers(name, phone, avatar_url), services(name)")
      .eq("barber_id", session.barber_id);
    
    if (allApps) {
      setAppointments(allApps.sort((a,b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
    }
  };

  useEffect(() => {
    const bId = session?.barber_id;
    if (bId) {
      fetchData();
      const channel = supabase
        .channel(`prof-realtime-${bId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `barber_id=eq.${bId}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `barber_id=eq.${bId}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'barbers', filter: `id=eq.${bId}` }, fetchData)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [session?.barber_id]);

  const handleAction = async (app: any, status: string) => {
    try {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", app.id);
      if (error) throw error;
      toast.success(status === 'completed' ? "Atendimento concluído!" : "Status atualizado!");
      fetchData();
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading || !stats) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  if (!session) return null;

  const dayNames: Record<string, string> = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo"
  };

  const sortedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <AppLayout>
      <div className="space-y-8 pb-12 px-4 md:px-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-6 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/10 shadow-sm">
              <AvatarImage src={barber?.avatar_url} />
              <AvatarFallback>{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">Olá, {session.name} 👋</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn(barber?.active ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50")}>
                  {barber?.active ? "Disponível" : "Indisponível"}
                </Badge>
                <span className="text-xs text-muted-foreground">{barber?.category || "Profissional"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProfessionalNotifications barberId={session.barber_id} />
            <Button variant="outline" size="icon" onClick={fetchData} className="h-10 w-10 rounded-full border-primary/20 hover:bg-primary/5">
              <RefreshCcw className="h-5 w-5 text-primary" />
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Hoje</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.week} na semana</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Faturamento Mês</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.revenueMonth.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Ticket: R$ {stats.avgTicket.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cancelamentos</CardTitle>
              <X className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cancelledMonth}</div>
              <p className="text-xs text-muted-foreground mt-1">No mês atual</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Próximo</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {stats.nextApp ? format(new Date(stats.nextApp.start_time), "HH:mm") : "---"}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {stats.nextApp ? `Com ${stats.nextApp.customers?.name || 'Cliente'}` : "Sem agendamentos"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="appointments" className="gap-2">
              <Calendar className="h-4 w-4" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <TrendingUp className="h-4 w-4" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <UserIcon className="h-4 w-4" /> Perfil
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="appointments" className="mt-6 space-y-4">
            <div className="grid gap-4">
              {appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).length === 0 ? (
                <Card className="border-dashed py-12 text-center bg-muted/5">
                  <CardContent className="flex flex-col items-center">
                    <Calendar className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                    <p className="text-muted-foreground">Nenhum atendimento para hoje.</p>
                  </CardContent>
                </Card>
              ) : (
                appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).map(app => (
                  <Card key={app.id} className="overflow-hidden border shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center">
                      <div className="w-full md:w-32 bg-muted/30 p-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r">
                        <span className="text-2xl font-black text-primary">{format(new Date(app.start_time), "HH:mm")}</span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Hoje</span>
                      </div>
                      <div className="flex-1 p-4 flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={app.customers?.avatar_url} />
                          <AvatarFallback>{app.customers?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold truncate">{app.customers?.name || "Cliente"}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Scissors size={12} /> {app.services?.name}
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <Badge variant={app.payment_status === 'paid' ? 'default' : 'outline'} className={cn(
                            "text-[10px]",
                            app.payment_status === 'paid' ? "bg-green-600" : "text-amber-600 bg-amber-50"
                          )}>
                            {app.payment_status === 'paid' ? 'PAGO' : 'PENDENTE'}
                          </Badge>
                          <span className="font-bold text-sm">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-muted/10 flex items-center gap-2 border-t md:border-t-0 md:border-l">
                        {app.status === 'scheduled' || app.status === 'confirmed' ? (
                          <>
                            <Button size="sm" onClick={() => handleAction(app, 'completed')} className="bg-primary hover:bg-primary/90 flex-1">
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedAppointment(app); setShowCancelDialog(true); }} className="text-destructive hover:bg-destructive/5 flex-1">
                              <X className="h-4 w-4 mr-1" /> Cancelar
                            </Button>
                          </>
                        ) : (
                          <Badge className={cn(
                            "w-full justify-center py-1",
                            app.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {app.status === 'completed' ? 'CONCLUÍDO' : 'CANCELADO'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-4">
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle>Histórico de Atendimentos</CardTitle>
                <CardDescription>Lista completa dos seus serviços prestados.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {appointments.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground italic">Nenhum atendimento registrado.</div>
                  ) : (
                    appointments.map(app => (
                      <div key={app.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-muted flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-bold leading-none">{format(new Date(app.start_time), "dd")}</span>
                            <span className="text-[10px] uppercase text-muted-foreground">{format(new Date(app.start_time), "MMM", { locale: ptBR })}</span>
                          </div>
                          <div>
                            <p className="font-bold text-sm">{app.customers?.name || "Cliente"}</p>
                            <p className="text-xs text-muted-foreground">{app.services?.name} • {format(new Date(app.start_time), "HH:mm")}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-6">
                          <div className="text-right">
                            <p className="text-sm font-bold">R$ {Number(app.total_price || 0).toFixed(2)}</p>
                            <Badge className={cn(
                              "text-[10px]",
                              app.status === 'completed' ? "bg-green-100 text-green-700" :
                              app.status === 'cancelled' ? "bg-red-100 text-red-700" :
                              "bg-blue-100 text-blue-700"
                            )}>
                              {app.status === 'completed' ? 'CONCLUÍDO' : 
                               app.status === 'cancelled' ? 'CANCELADO' : 'AGENDADO'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Perfil Profissional</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setShowEditProfile(true)}>
                    <Edit2 className="h-4 w-4 mr-2" /> Editar Perfil
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-4 py-4">
                    <Avatar className="h-24 w-24 border-4 border-primary/10">
                      <AvatarImage src={barber?.avatar_url} />
                      <AvatarFallback className="text-3xl">{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <h3 className="text-xl font-bold">{barber?.name}</h3>
                      <p className="text-sm text-muted-foreground">{barber?.category || "Profissional"}</p>
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Bio / Descrição</p>
                      <p className="text-sm">{barber?.bio || "Sem descrição informada."}</p>
                    </div>
                    <div className="grid gap-2">
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-primary" />
                        <span>{barber?.phone || "Não informado"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="h-4 w-4 text-primary" />
                        <span>{barber?.email || "Não informado"}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Horários</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setShowEditSchedule(true)}>
                    <Edit2 className="h-4 w-4 mr-2" /> Editar Horários
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {barber?.working_hours ? (
                      sortedDays.map(dayKey => {
                        const config = barber.working_hours[dayKey];
                        if (!config) return null;
                        return (
                          <div key={dayKey} className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-colors",
                            config.enabled ? "bg-primary/5 border-primary/10" : "bg-muted/20 border-transparent opacity-50"
                          )}>
                            <span className="text-sm font-bold">{dayNames[dayKey]}</span>
                            <div className="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1 rounded-full border shadow-sm">
                              {config.enabled ? `${config.start} - ${config.end}` : "Fechado"}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center text-muted-foreground py-12">Nenhum horário cadastrado.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EditProfileDialog 
        isOpen={showEditProfile} 
        onClose={() => setShowEditProfile(false)} 
        barber={barber} 
        onUpdate={fetchData} 
      />
      <EditScheduleDialog 
        isOpen={showEditSchedule} 
        onClose={() => setShowEditSchedule(false)} 
        barber={barber} 
        onUpdate={fetchData} 
      />
      <CancelAppointmentDialog 
        isOpen={showCancelDialog} 
        onClose={() => setShowCancelDialog(false)} 
        appointment={selectedAppointment} 
        onConfirm={fetchData} 
      />
    </AppLayout>
  );
}
