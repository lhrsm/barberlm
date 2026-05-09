import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Phone, 
  History, 
  ShoppingBag, 
  Calendar, 
  LogOut, 
  User as UserIcon, 
  Clock, 
  Scissors,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  AlertTriangle,
  Edit2,
  Upload,
  Camera,
  Save,
  Mail
} from "lucide-react";
import { format, isAfter, subDays, parseISO, addMinutes, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/$slug/portal")({
  component: ClientPortalComponent,
});

function ClientPortalComponent() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shop, setShop] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  
  // Auth state
  const [phone, setPhone] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [customerName, setCustomerName] = useState("");

  // Data state
  const [appointments, setAppointments] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  
  // Edit state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [fetchingTimes, setFetchingTimes] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<any>(null);

  useEffect(() => {
    if (slug) {
      fetchShopData(slug);
    }
  }, [slug]);

  // Persistent session check
  useEffect(() => {
    const savedClient = localStorage.getItem(`client_portal_session_${slug}`);
    if (savedClient) {
      try {
        const parsedClient = JSON.parse(savedClient);
        setClient(parsedClient);
        setIsLoggedIn(true);
        fetchClientData(parsedClient.customer_id);
      } catch (e) {
        localStorage.removeItem(`client_portal_session_${slug}`);
      }
    }
  }, [slug]);
  
  // Real-time update for loyalty points and credits when an admin completes a service
  useEffect(() => {
    if (!client?.customer_id) return;

    // Subscribe to changes in the customers table for this specific client
    const customerChannel = supabase
      .channel('customer-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customers',
          filter: `id=eq.${client.customer_id}`
        },
        () => {
          fetchClientData(client.customer_id);
        }
      )
      .subscribe();

    // Also subscribe to changes in appointments
    const appointmentChannel = supabase
      .channel('appointment-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `customer_id=eq.${client.customer_id}`
        },
        () => {
          fetchClientData(client.customer_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(customerChannel);
      supabase.removeChannel(appointmentChannel);
    };
  }, [client?.customer_id]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'BOOKING_SUCCESS') {
        setIsBookingOpen(false);
        if (client?.customer_id) {
          fetchClientData(client.customer_id);
        }
        toast.success("Agendamento realizado com sucesso!");
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [client?.customer_id]);

  async function fetchShopData(targetSlug: string) {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("slug", targetSlug)
        .single();

      if (error || !profile) {
        toast.error("Barbearia não encontrada");
        navigate({ to: "/" });
        return;
      }
      setShop(profile);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClientData(customerId: string) {
    if (!customerId) return;
    
    // Fetch customer profile for credits/cashback
    const { data: profile } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();
    
    setCustomerData(profile);

    // Fetch appointments
    const { data: appts } = await supabase
      .from("appointments")
      .select("*, services(name), barbers(name)")
      .eq("customer_id", customerId)
      .order("start_time", { ascending: false });
    
    setAppointments(appts || []);
    if (appts) checkAutoCancellation(appts);

    // Fetch sales
    const { data: saleData } = await supabase
      .from("product_sales")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    
    setSales(saleData || []);
  }

  useEffect(() => {
    if (isEditModalOpen && editingAppointment && newDate) {
      fetchAvailableTimes(editingAppointment.barber_id, newDate);
    }
  }, [isEditModalOpen, editingAppointment, newDate]);

  async function fetchAvailableTimes(barberId: string, date: string) {
    setFetchingTimes(true);
    try {
      const { data: barber } = await supabase
        .from("barbers")
        .select("*")
        .eq("id", barberId)
        .single();

      if (!barber) return;

      const dateObj = parseISO(date);
      const dayName = format(dateObj, "eeee", { locale: ptBR }).toLowerCase();
      
      const dayMap: Record<string, string> = {
        'segunda-feira': 'monday',
        'terça-feira': 'tuesday',
        'quarta-feira': 'wednesday',
        'quinta-feira': 'thursday',
        'sexta-feira': 'friday',
        'sábado': 'saturday',
        'domingo': 'sunday'
      };
      
      const dayKey = dayMap[dayName] || dayName;
      const workingHours = (barber.working_hours as any)?.[dayKey];

      if (!workingHours || !workingHours.enabled) {
        setAvailableTimes([]);
        return;
      }

      const startOfDayTime = `${date}T00:00:00Z`;
      const endOfDayTime = `${date}T23:59:59Z`;

      const { data: appointments } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("barber_id", barberId)
        .eq("status", "scheduled")
        .gte("start_time", startOfDayTime)
        .lte("start_time", endOfDayTime);

      const times = [];
      const [startHour, startMin] = workingHours.start.split(':').map(Number);
      const [endHour, endMin] = workingHours.end.split(':').map(Number);
      const interval = 30;

      for (let hour = startHour; hour <= endHour; hour++) {
        for (let min = (hour === startHour ? startMin : 0); min < 60; min += interval) {
          if (hour === endHour && min >= endMin) break;
          
          const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          const checkTime = parseISO(`${date}T${timeStr}:00`);
          
          if (format(checkTime, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && checkTime < new Date()) {
            continue;
          }

          const isBusy = appointments?.some(app => {
            if (editingAppointment && app.start_time === editingAppointment.start_time) return false;
            const appStart = parseISO(app.start_time);
            const appEnd = parseISO(app.end_time);
            return checkTime >= appStart && checkTime < appEnd;
          });

          if (!isBusy) {
            times.push(timeStr);
          }
        }
      }
      setAvailableTimes(times);
    } catch (error) {
      console.error("Error fetching times:", error);
    } finally {
      setFetchingTimes(false);
    }
  }

  const handleEditAppointment = (app: any) => {
    setEditingAppointment(app);
    setNewDate(format(parseISO(app.start_time), "yyyy-MM-dd"));
    setNewTime(format(parseISO(app.start_time), "HH:mm"));
    setIsEditModalOpen(true);
  };

  const handleUpdateAppointment = async () => {
    if (!newDate || !newTime) {
      toast.error("Por favor, selecione data e horário");
      return;
    }

    setSubmitting(true);
    try {
      const startTime = parseISO(`${newDate}T${newTime}:00`);
      
      // Get service duration
      const { data: service } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", editingAppointment.service_id)
        .single();
        
      const duration = service?.duration_minutes || 30;
      const endTime = addMinutes(startTime, duration);

      const { error } = await supabase
        .from("appointments")
        .update({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString()
        })
        .eq("id", editingAppointment.id);

      if (error) throw error;

      toast.success("Agendamento alterado com sucesso!");
      setIsEditModalOpen(false);
      fetchClientData(client.customer_id);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao alterar agendamento");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      // Find customer in this specific shop first
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id, name")
        .eq("phone", phone)
        .eq("user_id", shop.id)
        .maybeSingle();

      if (!customerData) {
        toast.error("Telefone não encontrado nesta barbearia. Por favor, cadastre-se.");
        setIsRegistering(true);
        return;
      }

      // @ts-ignore - types are being updated
      const { data: authData, error: authError } = await supabase
        .from("client_auth")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

      if (authError) throw authError;
      
      let finalCustomerId = customerData.id;

      // If no auth record, create one
      if (!authData) {
        await supabase
          .from("client_auth")
          .insert({
            phone: phone,
            customer_id: finalCustomerId
          });
      }

      const sessionData = {
        phone: phone,
        customer_id: finalCustomerId,
        name: customerData.name
      };

      setClient(sessionData);
      setIsLoggedIn(true);
      localStorage.setItem(`client_portal_session_${slug}`, JSON.stringify(sessionData));
      fetchClientData(finalCustomerId);
      toast.success(`Bem-vindo de volta, ${sessionData.name}!`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Find or create customer for this shop
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id, name")
        .eq("phone", phone)
        .eq("user_id", shop.id)
        .maybeSingle();
      
      let customerId;
      let name = customerName;
      if (existingCustomer) {
        customerId = existingCustomer.id;
        name = existingCustomer.name;
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert({
            user_id: shop.id,
            name: customerName,
            phone: phone
          })
          .select("id")
          .single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }

      // 2. Create or update client_auth record (one record per phone globally is fine if we check customer in login)
      // @ts-ignore - types are being updated
      const { error: authErr } = await supabase
        .from("client_auth")
        .upsert({
          phone: phone,
          customer_id: customerId
        }, { onConflict: 'phone' });

      if (authErr) throw authErr;

      toast.success("Cadastro realizado com sucesso!");
      
      const sessionData = {
        phone: phone,
        customer_id: customerId,
        name: name
      };

      setClient(sessionData);
      setIsLoggedIn(true);
      localStorage.setItem(`client_portal_session_${slug}`, JSON.stringify(sessionData));
      fetchClientData(customerId);
    } catch (e: any) {
      toast.error(e.message || "Erro ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(`client_portal_session_${slug}`);
    setIsLoggedIn(false);
    setClient(null);
  };

  const handleClaimLoyaltyReward = async () => {
    if (!customerData || (customerData.loyalty_points || 0) < 10) return;

    setSubmitting(true);
    try {
      // Get the most expensive service price
      const { data: maxService } = await supabase
        .from("services")
        .select("price")
        .order("price", { ascending: false })
        .limit(1)
        .single();
      
      const rewardValue = Number(maxService?.price || 50);
      const newCredits = Number(customerData.credits || 0) + rewardValue;

      const { error } = await supabase
        .from("customers")
        .update({ 
          credits: newCredits,
          loyalty_points: (customerData.loyalty_points || 0) - 10 
        })
        .eq("id", customerData.id);

      if (error) throw error;

      toast.success(`Parabéns! Você recebeu R$ ${rewardValue.toFixed(2)} em créditos por sua fidelidade!`);
      fetchClientData(client.customer_id);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao resgatar recompensa");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (app: any) => {
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
    
    try {
      if (app.payment_status === 'paid' && app.payment_method === 'pix' && !app.refund_requested_at) {
        setCancellingAppointment(app);
        setIsRefundModalOpen(true);
        return;
      }

      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", app.id);
      
      if (error) throw error;
      toast.success("Agendamento cancelado");
      fetchClientData(client.customer_id);
    } catch (e) {
      toast.error("Erro ao cancelar agendamento");
    }
  };

  const handleProcessRefundChoice = async (type: 'credits' | 'refund') => {
    if (!cancellingAppointment) return;
    
    setSubmitting(true);
    try {
      const amount = Number(cancellingAppointment.total_price || 0);
      
      if (type === 'credits' && amount > 0) {
        // Immediate credit addition
        const { data: currentCust } = await supabase
          .from("customers")
          .select("credits")
          .eq("id", cancellingAppointment.customer_id)
          .single();
        
        const newCredits = Number(currentCust?.credits || 0) + amount;
        
        await supabase
          .from("customers")
          .update({ credits: newCredits })
          .eq("id", cancellingAppointment.customer_id);

        // Remove any realized revenue from transactions for this appointment
        // We delete all transactions for this appointment because they will be re-recorded
        // only when the client actually uses these credits for a future service.
        await supabase
          .from("transactions")
          .delete()
          .eq("appointment_id", cancellingAppointment.id);
          
        await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .eq("id", cancellingAppointment.id);
          
        toast.success(`Cancelado! R$ ${amount.toFixed(2)} foi adicionado aos seus créditos e removido das entradas.`);
      } else {
        // Request manual refund
        await supabase
          .from("appointments")
          .update({ 
            status: 'cancelled',
            refund_requested_at: new Date().toISOString(),
            refund_type: 'refund',
            refund_status: 'pending'
          })
          .eq("id", cancellingAppointment.id);
          
        toast.success("Cancelado! O pedido de estorno foi enviado para análise da barbearia.");
      }
      
      setIsRefundModalOpen(false);
      setCancellingAppointment(null);
      fetchClientData(client.customer_id);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao processar cancelamento");
    } finally {
      setSubmitting(false);
    }
  };

  // handleCompleteAppointment removed - only admin can complete appointments

  const checkAutoCancellation = async (appts: any[]) => {
    const now = new Date();
    const toCancel = appts.filter(app => {
      if (app.status !== 'scheduled') return false;
      const startTime = parseISO(app.start_time);
      // Cancel if it's more than 10 minutes past start time and still 'scheduled'
      return isAfter(now, addMinutes(startTime, 10));
    });

    if (toCancel.length === 0) return;

    for (const app of toCancel) {
      // If the appointment was paid via PIX and no refund/credit choice was made, auto-convert to credits
      if (app.payment_status === 'paid' && app.payment_method === 'pix' && !app.refund_requested_at) {
        const amount = Number(app.total_price || 0);
      if (amount > 0 && app.customer_id) {
        const { data: currentCust } = await supabase
          .from("customers")
          .select("credits")
          .eq("id", app.customer_id)
          .single();
        
        const newCredits = Number(currentCust?.credits || 0) + amount;
        
        await supabase
          .from("customers")
          .update({ credits: newCredits })
          .eq("id", app.customer_id);

        // Remove the income from transactions
        await supabase
          .from("transactions")
          .delete()
          .eq("appointment_id", app.id);
        
        await supabase
          .from("appointments")
          .update({ 
            status: 'cancelled',
            refund_requested_at: new Date().toISOString(),
            refund_type: 'credits',
            refund_status: 'completed',
            payment_status: 'refunded'
          })
          .eq("id", app.id);

        toast.info(`Agendamento expirado. R$ ${amount.toFixed(2)} foi adicionado aos seus créditos e removido das entradas.`);
      }
      } else {
        await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .eq("id", app.id);
      }
    }
    
    if (toCancel.length > 0) {
      fetchClientData(client.customer_id);
    }
  };

  const canCancel = (startTimeStr: string) => {
    const now = new Date();
    const startTime = parseISO(startTimeStr);
    const minutesUntil = differenceInMinutes(startTime, now);
    // Only allow cancellation if it's at least 10 minutes before the appointment
    // Allow cancellation anytime as long as it's in the future
    return minutesUntil > 0;
  };

  const handleRequestRefund = async (saleId: string) => {
    const reason = prompt("Por favor, informe o motivo do reembolso:");
    if (!reason) return;

    try {
      const { error } = await supabase
        .from("product_sales")
        .update({ 
          status: 'refunded',
          refund_requested_at: new Date().toISOString(),
          refund_reason: reason
        })
        .eq("id", saleId);
      
      if (error) throw error;
      toast.success("Pedido de reembolso enviado!");
      fetchClientData(client.customer_id);
    } catch (e) {
      toast.error("Erro ao processar reembolso");
    }
  };

  const canRefund = (createdAt: string) => {
    const date = parseISO(createdAt);
    const limitDate = subDays(new Date(), 7);
    return isAfter(date, limitDate);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">{shop?.business_name}</CardTitle>
            <CardDescription>Acesse seu portal do cliente para gerenciar seus pedidos</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
              {isRegistering && (
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Seu Nome</Label>
                  <Input 
                    id="reg-name" 
                    placeholder="João Silva" 
                    value={customerName} 
                    onChange={(e) => setCustomerName(e.target.value)} 
                    required 
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="phone" 
                    placeholder="11999999999" 
                    className="pl-10" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              {/* Senha removida para login simplificado apenas por telefone */}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Processando..." : (isRegistering ? "Cadastrar" : "Entrar")}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button 
                className="text-sm text-primary hover:underline" 
                onClick={() => setIsRegistering(!isRegistering)}
              >
                {isRegistering ? "Já tem conta? Entre aqui" : "Ainda não tem conta? Cadastre-se"}
              </button>
            </div>
          </CardContent>
        </Card>
        <Button variant="link" className="mt-4" onClick={() => navigate({ to: `/${slug}` })}>
          Voltar para a barbearia
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <UserIcon size={20} className="text-primary" />
            Portal do Cliente
          </h1>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut size={20} />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {customerData?.avatar_url && (
                <img 
                  src={customerData.avatar_url} 
                  alt={client.name} 
                  className="h-10 w-10 rounded-full object-cover border border-primary/20"
                />
              )}
              <h2 className="text-2xl font-bold">Olá, {client.name}!</h2>
            </div>
            <p className="text-muted-foreground">Bem-vindo à sua área exclusiva na {shop?.business_name}.</p>
          </div>
          <Button onClick={() => setIsBookingOpen(true)} className="gap-2">
            <Calendar size={18} /> Novo Agendamento
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Serviços</CardDescription>
              <CardTitle className="text-2xl font-bold">{appointments.filter(a => a.status === 'completed').length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Fidelidade</CardDescription>
              <CardTitle className="text-2xl font-bold flex items-center justify-between">
                <span>{customerData?.loyalty_points || 0} / 10</span>
                {customerData?.loyalty_points >= 10 && (
                  <Button size="sm" onClick={handleClaimLoyaltyReward} disabled={submitting} className="h-7 text-[10px] bg-amber-500 hover:bg-amber-600">
                    Resgatar
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Créditos</CardDescription>
              <CardTitle className="text-2xl font-bold text-green-600">R$ {customerData?.credits ? Number(customerData.credits).toFixed(2) : "0,00"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Cashback</CardDescription>
              <CardTitle className="text-2xl font-bold text-primary">R$ {customerData?.cashback_balance ? Number(customerData.cashback_balance).toFixed(2) : "0,00"}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
            <TabsTrigger value="appointments" className="gap-2">
              <Calendar size={16} /> Agendamentos
            </TabsTrigger>
            <TabsTrigger value="purchases" className="gap-2">
              <ShoppingBag size={16} /> Compras
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <UserIcon size={16} /> Perfil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Agendamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {appointments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <History size={48} className="mx-auto mb-4 opacity-20" />
                      <p>Nenhum agendamento encontrado.</p>
                    </div>
                  ) : (
                    appointments.map((app) => (
                      <div key={app.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl gap-4">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Scissors className="text-primary h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-bold">{app.services?.name}</p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock size={14} /> {format(parseISO(app.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                               <span className="flex items-center gap-1"><UserIcon size={14} /> {app.barbers?.name}</span>
                               <Badge variant="outline" className="capitalize text-[10px]">
                                 {app.payment_method === 'pix' ? 'Pago via PIX' : 
                                  app.payment_method === 'credits' ? 'Pago com Créditos' : 
                                  app.payment_method === 'cashback' ? 'Pago com Cashback' : 'Pagar na Barbearia'}
                               </Badge>
                               {app.notes && app.notes.includes('Pagamento:') && (
                                 <span className="text-[10px] text-primary font-medium">{app.notes}</span>
                               )}
                               {app.status === 'cancelled' && app.refund_requested_at && (
                                 <Badge variant="outline" className={cn(
                                   "text-[10px] ml-2",
                                   app.refund_status === 'completed' ? 'text-green-600 border-green-200 bg-green-50' : 'text-amber-600 border-amber-200 bg-amber-50'
                                 )}>
                                   {app.refund_type === 'credits' ? 'Créditos' : 'Estorno'}: {app.refund_status === 'completed' ? 'Concluído' : 'Pendente'}
                                 </Badge>
                               )}
                             </div>
                           </div>
                         </div>
                         <div className="flex items-center gap-3 self-end sm:self-center">
                           <Badge className={cn(
                             app.payment_status === 'paid' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-outline border text-foreground'
                           )}>
                             {app.payment_status === 'paid' ? 'Pago' : 'Pagamento Pendente'}
                           </Badge>
                            <Badge variant={app.status === 'completed' ? 'default' : app.status === 'scheduled' ? 'secondary' : 'destructive'} className={cn(
                              app.status === 'completed' && "bg-green-600 hover:bg-green-700",
                              app.status === 'scheduled' && "bg-blue-500 hover:bg-blue-600",
                              app.status === 'cancelled' && "bg-red-500 hover:bg-red-600"
                            )}>
                              {app.status === 'completed' ? 'Concluído' : app.status === 'scheduled' ? 'Agendado' : 'Cancelado'}
                            </Badge>
                           {app.status === 'scheduled' && (
                             <div className="flex flex-wrap items-center gap-1">
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 className="text-primary h-8 px-2 text-xs"
                                 onClick={() => handleEditAppointment(app)}
                                >
                                 <Edit2 size={14} className="mr-1" /> Editar
                               </Button>
                               {canCancel(app.start_time) && (
                                 <Button 
                                   variant="ghost" 
                                   size="sm" 
                                   className="text-destructive h-8 px-2 text-xs"
                                   onClick={() => handleCancelAppointment(app)}
                                 >
                                   Cancelar
                                 </Button>
                               )}
                             </div>
                           )}
                         </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases" className="pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Suas Compras</CardTitle>
                <CardDescription>Os reembolsos podem ser solicitados em até 7 dias após a compra.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sales.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                      <p>Nenhuma compra encontrada.</p>
                    </div>
                  ) : (
                    sales.map((sale) => (
                      <div key={sale.id} className="flex flex-col p-4 border rounded-xl gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              {format(parseISO(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                            <Badge 
                              variant={sale.status === 'completed' ? 'default' : 'secondary'}
                              className={cn(
                                sale.status === 'completed' && "bg-green-600 hover:bg-green-700",
                                sale.status === 'refunded' && "bg-amber-500 hover:bg-amber-600",
                                sale.status === 'pending' && "bg-slate-400 hover:bg-slate-500"
                              )}
                            >
                              {sale.status === 'completed' ? 'Concluído' : sale.status === 'refunded' ? 'Reembolsado' : 'Pendente'}
                            </Badge>
                          </div>
                          <span className="font-bold text-lg text-primary">R$ {sale.total_amount.toFixed(2)}</span>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Itens:</p>
                          <ul className="space-y-1">
                            {(sale.items as any[]).map((item, idx) => (
                              <li key={idx} className="text-sm flex justify-between">
                                <span>{item.name} x{item.quantity}</span>
                                <span className="text-muted-foreground">R$ {(item.price * item.quantity).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {sale.status === 'completed' && (
                          <div className="flex justify-end pt-2">
                            {canRefund(sale.created_at) ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 h-8 text-amber-600 border-amber-200 hover:bg-amber-50"
                                onClick={() => handleRequestRefund(sale.id)}
                              >
                                <RefreshCcw size={14} /> Pedir Reembolso
                              </Button>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <AlertTriangle size={14} />
                                Prazo de reembolso expirado (7 dias)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="profile" className="pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Meu Perfil</CardTitle>
                <CardDescription>Atualize suas informações de contato e foto de perfil.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative group">
                    <div className="h-24 w-24 rounded-full bg-muted overflow-hidden border-2 border-primary/20">
                      {customerData?.avatar_url ? (
                        <img src={customerData.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-3xl font-bold text-muted-foreground bg-primary/5">
                          {customerData?.name?.[0] || "?"}
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg hover:scale-110 transition-transform">
                      <Camera size={14} />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !customerData?.id) return;
                          
                          setSubmitting(true);
                          try {
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${customerData.id}-${Math.random()}.${fileExt}`;
                            const filePath = `customer-avatars/${fileName}`;

                            const { error: uploadError } = await supabase.storage
                              .from('barber-avatars')
                              .upload(filePath, file);

                            if (uploadError) throw uploadError;

                            const { data: { publicUrl } } = supabase.storage
                              .from('barber-avatars')
                              .getPublicUrl(filePath);

                            const { error: updateError } = await supabase
                              .from('customers')
                              .update({ avatar_url: publicUrl })
                              .eq('id', customerData.id);

                            if (updateError) throw updateError;
                            
                            toast.success("Foto atualizada!");
                            fetchClientData(customerData.id);
                          } catch (err: any) {
                            toast.error("Erro ao enviar imagem");
                            console.error(err);
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">Clique no ícone para alterar sua foto</p>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="profile-name">Nome Completo</Label>
                    <Input 
                      id="profile-name" 
                      value={customerName || (customerData?.name || "")} 
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="profile-email" 
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10"
                        defaultValue={customerData?.email || ""}
                        onBlur={async (e) => {
                          if (!customerData?.id) return;
                          const email = e.target.value;
                          const { error } = await supabase
                            .from('customers')
                            .update({ email })
                            .eq('id', customerData.id);
                          if (!error) toast.success("E-mail atualizado!");
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-phone">WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="profile-phone" 
                        value={customerData?.phone || ""} 
                        disabled 
                        className="pl-10 bg-muted"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">O número de telefone não pode ser alterado.</p>
                  </div>
                </div>
              </CardContent>
              <CardContent className="pt-0 pb-6">
                <Button 
                  className="w-full gap-2" 
                  disabled={submitting}
                  onClick={async () => {
                    if (!customerData?.id || !customerName) return;
                    setSubmitting(true);
                    try {
                      const { error } = await supabase
                        .from('customers')
                        .update({ name: customerName })
                        .eq('id', customerData.id);
                      if (error) throw error;
                      
                      // Update local session
                      const sessionData = JSON.parse(localStorage.getItem(`client_portal_session_${slug}`) || "{}");
                      sessionData.name = customerName;
                      localStorage.setItem(`client_portal_session_${slug}`, JSON.stringify(sessionData));
                      setClient(sessionData);
                      
                      toast.success("Perfil atualizado com sucesso!");
                      fetchClientData(customerData.id);
                    } catch (e) {
                      toast.error("Erro ao salvar alterações");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  <Save size={18} /> {submitting ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Alterar Agendamento</DialogTitle>
            <DialogDescription>Escolha uma nova data e horário para seu serviço.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-date">Nova Data</Label>
              <Input 
                id="edit-date" 
                type="date" 
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="grid gap-2">
              <Label>Novo Horário</Label>
              {fetchingTimes ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : availableTimes.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto p-1">
                  {availableTimes.map(time => (
                    <Button
                      key={time}
                      variant={newTime === time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewTime(time)}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center text-muted-foreground py-4">Nenhum horário disponível para esta data.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateAppointment} disabled={submitting || !newTime}>
              {submitting ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>Preencha os dados abaixo para agendar seu novo serviço.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <iframe 
              src={`/${slug}?embed=true&phone=${client.phone}&name=${encodeURIComponent(client.name)}`} 
              className="w-full h-[650px] border-none rounded-lg"
              title="Agendamento"
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isRefundModalOpen} onOpenChange={setIsRefundModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opções de Reembolso</DialogTitle>
            <DialogDescription>
              Este agendamento foi pago via Pix. Como deseja receber o valor de 
              <span className="font-bold text-foreground"> R$ {Number(cancellingAppointment?.total_price || 0).toFixed(2)}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-start gap-1 border-green-200 hover:bg-green-50 hover:border-green-300 transition-all"
              onClick={() => handleProcessRefundChoice('credits')}
              disabled={submitting}
            >
              <div className="flex items-center gap-2">
                <RefreshCcw className="h-5 w-5 text-green-600" />
                <span className="font-bold text-green-700">Créditos na Barbearia</span>
              </div>
              <span className="text-xs text-green-600/80 text-left">O valor cai na hora na sua conta para usar no próximo agendamento.</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-start gap-1 border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all"
              onClick={() => handleProcessRefundChoice('refund')}
              disabled={submitting}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
                <span className="font-bold text-blue-700">Estorno (Pix)</span>
              </div>
              <span className="text-xs text-blue-600/80 text-left">Solicitar o estorno manual do valor. Sujeito à análise da barbearia.</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRefundModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
