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
    
    if (allApps) setAppointments(allApps.sort((a,b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
  };

  useEffect(() => {
    if (session?.barber_id) {
      fetchData();
      const channel = supabase
        .channel(`prof-realtime-${session.barber_id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `barber_id=eq.${session.barber_id}` }, fetchData)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [session?.barber_id]);

  const handleAction = async (app: any, status: string) => {
    try {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", app.id);
      if (error) throw error;
      toast.success("Status atualizado!");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading || !stats) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

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
              <Badge variant="outline" className={cn("mt-1", barber?.active ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50")}>
                {barber?.active ? "Disponível" : "Indisponível"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProfessionalNotifications barberId={session.barber_id} />
            <Button variant="ghost" size="sm" onClick={logout} className="text-destructive"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Hoje</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.today}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Faturamento Mês</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">R$ {stats.revenueMonth.toFixed(2)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ticket Médio</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">R$ {stats.avgTicket.toFixed(2)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Próximo</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{stats.nextApp ? format(new Date(stats.nextApp.start_time), "HH:mm") : "---"}</div></CardContent></Card>
        </div>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList>
            <TabsTrigger value="appointments">Agenda</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
          </TabsList>
          <TabsContent value="appointments" className="space-y-4 pt-4">
            {appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).map(app => (
              <Card key={app.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-bold">{app.customers?.name}</p>
                    <p className="text-xs text-muted-foreground">{app.services?.name} - {format(new Date(app.start_time), "HH:mm")}</p>
                  </div>
                  <div className="flex gap-2">
                    {app.status === 'scheduled' && (
                      <>
                        <Button size="sm" onClick={() => handleAction(app, 'completed')}>Concluir</Button>
                        <Button size="sm" variant="destructive" onClick={() => { setSelectedAppointment(app); setShowCancelDialog(true); }}>Cancelar</Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="profile" className="space-y-4 pt-4">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Perfil</CardTitle>
                  <Button size="sm" onClick={() => setShowEditProfile(true)}><Edit2 className="h-4 w-4 mr-2" /> Editar</Button>
                </CardHeader>
                <CardContent>
                  <p><strong>Bio:</strong> {barber?.bio || "Sem bio"}</p>
                  <p><strong>Especialidades:</strong> {barber?.specialties?.join(", ") || "Nenhuma"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Horários</CardTitle>
                  <Button size="sm" onClick={() => setShowEditSchedule(true)}><Edit2 className="h-4 w-4 mr-2" /> Editar</Button>
                </CardHeader>
                <CardContent>
                  {/* Horários aqui */}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EditProfileDialog isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} barber={barber} onUpdate={fetchData} />
      <EditScheduleDialog isOpen={showEditSchedule} onClose={() => setShowEditSchedule(false)} barber={barber} onUpdate={fetchData} />
      <CancelAppointmentDialog isOpen={showCancelDialog} onClose={() => setShowCancelDialog(false)} appointment={selectedAppointment} onConfirm={fetchData} />
    </AppLayout>
  );
}
