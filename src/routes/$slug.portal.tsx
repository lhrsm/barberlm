import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";

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
  Mail,
  Plus,
  QrCode,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format, isAfter, subDays, parseISO, addMinutes, differenceInMinutes, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { normalizePhone, formatPhoneMask } from "@/utils/phone";
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";

export const Route = createFileRoute("/$slug/portal")({
  component: ClientPortalComponent,
});


function ClientPortalComponent() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  // DEBUG LOGS
  console.log('SLUG', slug);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shop, setShop] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  
  // Auth state
  // phone state is already declared above
  const [isRegistering, setIsRegistering] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerBirthDate, setCustomerBirthDate] = useState("");
  const [customerAvatar, setCustomerAvatar] = useState<File | null>(null);

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
  const [creditTransactions, setCreditTransactions] = useState<any[]>([]);
  const [cashbackTransactions, setCashbackTransactions] = useState<any[]>([]);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchShopData(slug);
    }
  }, [slug]);

  // Persistent session check
  useEffect(() => {
    console.log('DEBUG: Checking for saved portal session', slug);
    const savedClient = localStorage.getItem(`client_portal_session_${slug}`);
    if (savedClient) {
      try {
        const parsedClient = JSON.parse(savedClient);
        console.log('CUSTOMER SESSION', parsedClient);
        console.log('CLIENT AUTH', { isLoggedIn: true, customer: parsedClient });
        console.log('DEBUG: Found saved session', parsedClient);
        setClient(parsedClient);
        setPhone(parsedClient.phone);
        setCustomerName(parsedClient.name);
        setIsLoggedIn(true);
        fetchClientData(parsedClient.customer_id);
      } catch (e) {
        console.error('DEBUG: Failed to parse saved session', e);
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
        if (client?.customer_id) {
          fetchClientData(client.customer_id);
        }
        toast.success("Agendamento realizado com sucesso!");
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [client?.customer_id, slug]);


  // Sync customer phone and name from client session for booking
  useEffect(() => {
    if (isLoggedIn && client) {
      setPhone(client.phone || "");
      setCustomerName(client.name || "");
    }
  }, [isLoggedIn, client]);

  async function fetchShopData(targetSlug: string) {
    try {
      const normalizedSlug = targetSlug.trim().toLowerCase();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("slug", normalizedSlug)
        .single();

      if (error || !profile) {
        toast.error("Barbearia não encontrada");
        navigate({ to: "/" });
        return;
      }
      setShop(profile);

      // Fetch services, barbers and products for booking
      const [servicesRes, barbersRes, productsRes] = await Promise.all([
        supabase
          .from("services")
          .select("*")
          .eq("user_id", profile.id)
          .eq("active", true),
        supabase
          .from("barbers")
          .select("*, barber_services(service_id)")
          .eq("user_id", profile.id)
          .eq("active", true),
        supabase
          .from("products")
          .select("*")
          .eq("user_id", profile.id)
          .eq("active", true),
      ]);

      setServices(servicesRes.data || []);
      setBarbers(barbersRes.data || []);
      setProducts(productsRes.data || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handlePortalBooking = () => {
    console.log('portalCustomer', client);
    if (!client?.customer_id) {
      toast.error("Cliente não autenticado");
      setIsLoggedIn(false);
      return;
    }

    // Apenas emitir o evento para o pai (ShopPageComponent) abrir a modal unificada
    window.dispatchEvent(new CustomEvent('OPEN_BOOKING_MODAL'));
  };



  async function fetchClientData(customerId: string) {
    if (!customerId) return;
    
    // Fetch customer profile for credits/cashback
    const { data: profile } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();
    
    setCustomerData(profile);

    // Fetch transactions
    const [creditsRes, cashbackRes] = await Promise.all([
      supabase.from("credit_transactions").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
      supabase.from("cashback_transactions").select("*").eq("customer_id", customerId).order("created_at", { ascending: false })
    ]);
    
    setCreditTransactions(creditsRes.data || []);
    setCashbackTransactions(cashbackRes.data || []);

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
    if (!barberId) {
      console.warn('DEBUG: No professional selected, skipping fetchAvailableTimes');
      return;
    }

    setFetchingTimes(true);
    try {
      const { data: barber, error: barberError } = await supabase
        .from("barbers")
        .select("*")
        .eq("id", barberId)
        .single();

      if (barberError || !barber) {
        console.error("Barber not found:", barberError);
        return;
      }

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

      const startOfDayTime = `${date}T00:00:00.000Z`;
      const endOfDayTime = `${date}T23:59:59.999Z`;

      const { data: appointments, error: apptError } = await supabase
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
        for (let min = (hour === startHour ? startMin : 0); min < 60; min += 30) {
          if (hour === endHour && min >= endMin) break;
          
          const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          const [y, m, d] = date.split('-').map(Number);
          const checkTime = new Date(y, m - 1, d, hour, min, 0);
          const now = new Date();
          const isToday = y === now.getFullYear() && (m - 1) === now.getMonth() && d === now.getDate();
          
          if (isToday && checkTime < now) continue;

          const isBusy = appointments?.some(app => {
            if (editingAppointment && app.start_time === editingAppointment.start_time) return false;
            const appStart = parseISO(app.start_time);
            const appEnd = parseISO(app.end_time);
            return checkTime >= appStart && checkTime < appEnd;
          });

          if (!isBusy) times.push(timeStr);
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

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalized = normalizePhone(phone);
    console.log('DEBUG: Normalizing phone for login:', { original: phone, normalized });
    
    if (normalized.length < 10) {
      toast.error("Por favor, informe um WhatsApp válido com DDD.");
      return;
    }

    setSubmitting(true);
    try {
      // Find customer in this specific shop first
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id, name")
        .eq("phone", normalized)
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
        .eq("phone", normalized)
        .maybeSingle();

      if (authError) throw authError;
      
      let finalCustomerId = customerData.id;

      // If no auth record, create one
      if (!authData) {
        await supabase
          .from("client_auth")
          .insert({
            phone: normalized,
            customer_id: finalCustomerId
          });
      }

      const sessionData = {
        phone: normalized,
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
    const normalized = normalizePhone(phone);
    console.log('DEBUG: Normalizing phone for registration:', { original: phone, normalized });
    setSubmitting(true);
    try {
      // 1. Find or create customer for this shop
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id, name")
        .eq("phone", normalized)
        .eq("user_id", shop.id)
        .maybeSingle();
      
      let customerId;
      let name = customerName;
      let avatarUrl = "";

      // Convert DD/MM/YYYY to YYYY-MM-DD
      let formattedBirthDate = undefined;
      if (customerBirthDate && customerBirthDate.includes("/")) {
        const [day, month, year] = customerBirthDate.split("/");
        if (day && month && year && year.length === 4) {
          formattedBirthDate = `${year}-${month}-${day}`;
        }
      }

      // Upload avatar if provided
      if (customerAvatar) {
        const fileExt = customerAvatar.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `customer-avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('barber-avatars')
          .upload(filePath, customerAvatar);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('barber-avatars')
            .getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
        name = existingCustomer.name;
        
        // Update existing customer with new info if provided
        await supabase
          .from("customers")
          .update({
            email: customerEmail || undefined,
            birth_date: formattedBirthDate || undefined,
            avatar_url: avatarUrl || undefined
          })
          .eq("id", customerId);
      } else {
        // For new customers in the portal, we need a barber_id for RLS
        // We'll pick the first active barber from the shop as default if none selected
        const defaultBarberId = barbers[0]?.id;
        
        if (!defaultBarberId) {
          throw new Error("Não foi possível identificar um profissional para o cadastro.");
        }


        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert([{
            user_id: shop.id,
            barber_id: defaultBarberId,
            name: customerName,
            phone: normalized,
            email: customerEmail || undefined,
            birth_date: formattedBirthDate || undefined,
            avatar_url: avatarUrl || undefined
          }])
          .select("id")
          .single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }

      // 2. Create or update client_auth record using a more robust check to avoid ON CONFLICT issues
      try {
        const { data: existingAuth } = await supabase
          .from("client_auth")
          .select("id")
          .eq("phone", normalized)
          .maybeSingle();

        if (existingAuth) {
          await supabase
            .from("client_auth")
            .update({ customer_id: customerId })
            .eq("id", existingAuth.id);
        } else {
          await supabase
            .from("client_auth")
            .insert({
              phone: normalized,
              customer_id: customerId
            });
        }
      } catch (authErr: any) {
        console.error("Error updating client_auth:", authErr);
        // We don't throw here to not block the registration if only the auth link fails
      }

      toast.success("Cadastro realizado com sucesso!");
      
      const sessionData = {
        phone: normalized,
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
    
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: app.id,
        p_cancelled_by: 'customer',
        p_source: 'customer_portal',
        p_refund_preference: 'none'
      });
      
      if (error) throw error;
      
      const result = data as any;
      if (result && result.pix_refund_amount > 0) {
        setCancellingAppointment(app);
        setIsRefundModalOpen(true);
        return;
      }

      toast.success("Agendamento cancelado com sucesso");
      fetchClientData(client.customer_id);
    } catch (e: any) {
      toast.error(e.message || "Erro ao cancelar agendamento");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessRefundChoice = async (type: 'credits' | 'refund') => {
    if (!cancellingAppointment) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: cancellingAppointment.id,
        p_cancelled_by: 'customer',
        p_source: 'customer_portal',
        p_refund_preference: type
      });
      
      if (error) throw error;

      toast.success(type === 'credits' ? "Valor convertido em créditos!" : "Solicitação de estorno enviada!");
      setIsRefundModalOpen(false);
      setCancellingAppointment(null);
      fetchClientData(client.customer_id);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao processar cancelamento");
    } finally {
      setSubmitting(false);
    }
  };

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
          // Registramos a saída para manter histórico e zerar o impacto líquido
          await supabase
            .from("transactions")
            .insert({
              user_id: app.user_id,
              appointment_id: app.id,
              type: "expense",
              category: "Estorno (Expiraçao)",
              amount: amount,
              description: `Agendamento expirado: ${app.services?.name} - Convertido em Créditos`,
              date: new Date().toISOString().split('T')[0]
            });

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black text-white">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground mb-4">Barbearia não encontrada.</p>
        <Button asChild>
          <a href="/">Voltar para o início</a>
        </Button>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-4xl font-black text-[#D4AF37] mb-2 uppercase italic tracking-tighter">Barber<span className="text-white">LM</span></h1>
          <p className="text-white/60 text-xs font-black uppercase tracking-[0.3em]">Portal do Cliente</p>
        </motion.div>

        <Card className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border-none p-2 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#D4AF37] via-black to-[#D4AF37]" />
          <CardHeader className="text-center pt-8">
            <CardTitle className="text-3xl font-black uppercase italic tracking-tighter text-black leading-none">{shop?.business_name}</CardTitle>
            <CardDescription className="text-gray-500 font-medium mt-2">Acesse seu histórico e agendamentos</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={isRegistering ? handleRegister : (e) => handleLogin(e)} className="space-y-6">
              {isRegistering && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Seu Nome Completo</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input 
                        id="reg-name" 
                        placeholder="João Silva" 
                        className="h-14 pl-12 border-gray-100 bg-gray-50 focus:bg-white focus:border-[#D4AF37] focus:ring-[#D4AF37] text-black text-lg font-bold rounded-2xl transition-all"
                        value={customerName} 
                        onChange={(e) => setCustomerName(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">WhatsApp</Label>
                <div className="relative international-phone-portal">
                  <PhoneInput
                    defaultCountry="br"
                    value={phone}
                    onChange={(p) => setPhone(p)}
                    className="w-full"
                    inputClassName="!w-full !h-14 !bg-gray-50 !border-gray-100 !focus:bg-white !focus:border-[#D4AF37] !focus:ring-[#D4AF37] !text-black !text-lg !font-bold !rounded-2xl !pl-12 !transition-all"
                    countrySelectorStyleProps={{
                      buttonClassName: "!h-14 !bg-transparent !border-none !absolute !left-0 !z-10 !rounded-l-2xl",
                      flagClassName: "!ml-2"
                    }}
                  />
                  <style>{`
                    .international-phone-portal .react-international-phone-input-container {
                      width: 100%;
                    }
                    .international-phone-portal .react-international-phone-input {
                      width: 100% !important;
                      padding-left: 55px !important;
                    }
                  `}</style>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-[64px] bg-[#000] text-[#FFF] hover:bg-gradient-to-br hover:from-[#000000] hover:to-[#1F2937] transition-all duration-300 hover:-translate-y-[2px] active:translate-y-0 font-extrabold text-[22px] uppercase tracking-[0.5px] rounded-[22px] shadow-[0_12px_30px_rgba(0,0,0,0.25)] hover:shadow-[0_16px_35px_rgba(0,0,0,0.35)] disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={submitting}
              >
                {submitting ? "Processando..." : (isRegistering ? "Criar Conta" : "Entrar no Portal")}
              </Button>
            </form>
            
            <div className="mt-4 text-center pt-6 border-t border-gray-100/10">
              <p className="text-sm text-gray-500 font-bold flex items-center justify-center gap-2">
                <span>{isRegistering ? "Já tem conta?" : "Ainda não tem conta?"}</span>
                <button 
                  type="button"
                  className="text-[#D4AF37] hover:text-[#F5C542] transition-all duration-300 font-extrabold border-b-2 border-[#D4AF37] hover:border-[#F5C542] pb-[2px] hover:-translate-y-[1px]" 
                  onClick={() => setIsRegistering(!isRegistering)}
                >
                  {isRegistering ? "Fazer Login" : "Cadastre-se"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Button 
          variant="ghost" 
          className="mt-4 w-full h-[48px] bg-[rgba(255,255,255,0.10)] border border-[rgba(212,175,55,0.45)] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#000] transition-all duration-300 rounded-[16px] font-extrabold text-[14px] tracking-[1px] uppercase hover:-translate-y-[2px] active:translate-y-0 hover:shadow-[0_10px_25px_rgba(212,175,55,0.25)]" 
          onClick={() => navigate({ to: `/${slug}` })}
        >
          <ChevronLeft className="mr-2" size={18} /> Voltar para a barbearia
        </Button>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black pb-20">
      <header className="bg-black border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2 text-[#D4AF37]">
            <UserIcon size={20} />
            Portal do Cliente
          </h1>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="text-white hover:bg-white/10">
            <LogOut size={20} />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {customerData?.avatar_url ? (
              <img 
                src={customerData.avatar_url} 
                alt={client.name} 
                className="h-16 w-16 rounded-full object-cover border-2 border-[#D4AF37]"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] border-2 border-[#D4AF37]">
                <UserIcon size={32} />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">Olá, {client.name}!</h2>
              <p className="text-sm text-gray-400">Bem-vindo à sua área exclusiva na <span className="font-semibold text-white">{shop?.business_name}</span>.</p>
            </div>
          </div>
          <Button 
            onClick={() => {
              // Limpar estados do agendamento local para garantir que a modal padrão abra do zero
              // Mas aqui vamos apenas redirecionar ou emitir um evento se quisermos usar o componente pai.
              // Como estamos em /$slug/portal, o componente pai ShopPageComponent está ativo e tem o isBookingOpen.
              // Podemos tentar emitir um evento ou usar o contexto se disponível.
              // No BarberLM, o $slug.tsx envolve o Outlet.
              
              // Emitir evento para o pai (ShopPageComponent)
              window.dispatchEvent(new CustomEvent('OPEN_BOOKING_MODAL'));
            }} 
            className="gap-2 bg-black text-white border border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all duration-300 hover:scale-105"
          >
            <Calendar size={18} /> Novo Agendamento
          </Button>

        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card className="bg-white/5 border-white/10 shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Total de Serviços</CardDescription>
              <CardTitle className="text-2xl font-bold text-white">{appointments.filter(a => a.status === 'completed').length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white/5 border-white/10 shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Fidelidade</CardDescription>
              <CardTitle className="text-2xl font-bold flex items-center justify-between text-white">
                <span>{customerData?.loyalty_points || 0} / 10</span>
                {customerData?.loyalty_points >= 10 && (
                  <Button size="sm" onClick={handleClaimLoyaltyReward} disabled={submitting} className="h-7 text-[10px] bg-[#D4AF37] hover:bg-[#B8860B] text-white">
                    Resgatar
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white/5 border-white/10 shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Créditos</CardDescription>
              <CardTitle className="text-2xl font-bold text-green-500">R$ {customerData?.credits ? Number(customerData.credits).toFixed(2) : "0,00"}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white/5 border-white/10 shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Cashback</CardDescription>
              <CardTitle className="text-2xl font-bold text-[#D4AF37]">R$ {customerData?.cashback_balance ? Number(customerData.cashback_balance).toFixed(2) : "0,00"}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-[600px] bg-white/5 p-1 rounded-xl">
            <TabsTrigger value="appointments" className="gap-2 rounded-lg data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black data-[state=active]:shadow-sm text-white">
              <Calendar size={16} /> Agendamentos
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="gap-2 rounded-lg data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black data-[state=active]:shadow-sm text-white">
               Fidelidade
            </TabsTrigger>
            <TabsTrigger value="finances" className="gap-2 rounded-lg data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black data-[state=active]:shadow-sm text-white">
               Extrato
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2 rounded-lg data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black data-[state=active]:shadow-sm text-white">
              <UserIcon size={16} /> Perfil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="pt-6">
            <Card className="bg-white/5 border-white/10 shadow-lg">
              <CardHeader>
                <CardTitle className="text-white">Histórico de Agendamentos</CardTitle>
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
                      <div 
                        key={app.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          setSelectedAppointmentId(app.id);
                          setIsDetailsModalOpen(true);
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center shrink-0">
                            <Scissors className="text-[#D4AF37] h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-bold text-white">{app.services?.name}</p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-400">
                              <span className="flex items-center gap-1"><Clock size={14} /> {format(parseISO(app.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                               <span className="flex items-center gap-1"><UserIcon size={14} /> {app.barbers?.name}</span>
                               <Badge variant="outline" className="capitalize text-[10px]">
                               {app.payment_method === 'pix' ? 'Pago via PIX' : 
                                  app.payment_method === 'credits' ? 'Pago com Créditos' : 
                                  app.payment_method === 'cashback' ? 'Pago com Cashback' : 'Pagar na Barbearia'}
                               </Badge>
                               {app.notes && app.notes.includes('Pagamento:') && (
                                 <span className="text-[10px] text-[#D4AF37] font-medium">{app.notes}</span>
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
                           {app.status === 'cancelled' ? (
                             <Badge variant="outline" className="text-zinc-400 border-zinc-200">
                               Sem cobrança
                             </Badge>
                           ) : (
                             <Badge className={cn(
                               app.payment_status === 'paid' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-outline border text-foreground'
                             )}>
                               {app.payment_status === 'paid' ? 'Pago' : 'Pagamento Pendente'}
                             </Badge>
                           )}
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
                                 className="text-white hover:text-[#D4AF37] hover:bg-white/10 h-8 px-2 text-xs transition-all duration-300 hover:scale-105"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleEditAppointment(app);
                                 }}
                                >
                                 <Edit2 size={14} className="mr-1" /> Editar
                               </Button>
                               {canCancel(app.start_time) && (
                                 <Button 
                                   variant="ghost" 
                                   size="sm" 
                                   className="text-destructive h-8 px-2 text-xs"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     handleCancelAppointment(app);
                                   }}
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

          <TabsContent value="loyalty" className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="bg-white/5 border-white/10 shadow-lg">
                 <CardHeader>
                   <CardTitle className="text-white">Programa de Fidelidade</CardTitle>
                   <CardDescription className="text-gray-400">Junte pontos em cada atendimento e troque por créditos.</CardDescription>
                 </CardHeader>
                 <CardContent className="flex flex-col items-center py-10">
                    <div className="relative h-40 w-40 flex items-center justify-center">
                       <svg className="h-full w-full rotate-[-90deg]">
                          <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                          <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="440" strokeDashoffset={440 - (440 * Math.min(customerData?.loyalty_points || 0, 10)) / 10} className="text-[#D4AF37] transition-all duration-1000" />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-black text-white">{customerData?.loyalty_points || 0}</span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">de 10 pontos</span>
                       </div>
                    </div>
                    {customerData?.loyalty_points >= 10 ? (
                      <Button onClick={handleClaimLoyaltyReward} disabled={submitting} className="mt-8 bg-[#D4AF37] text-black font-black uppercase tracking-tighter hover:scale-105 transition-all">
                        Resgatar R$ 50,00 Agora
                      </Button>
                    ) : (
                      <p className="mt-8 text-sm text-gray-400 font-medium italic text-center px-4">Faltam {10 - (customerData?.loyalty_points || 0)} pontos para você ganhar seu próximo bônus!</p>
                    )}
                 </CardContent>
               </Card>

               <Card className="bg-white/5 border-white/10 shadow-lg">
                 <CardHeader>
                   <CardTitle className="text-white">Como Funciona?</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="flex gap-4">
                       <div className="h-8 w-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-black shrink-0">1</div>
                       <p className="text-sm text-gray-400">Cada agendamento concluído gera 1 ponto no seu cartão fidelidade.</p>
                    </div>
                    <div className="flex gap-4">
                       <div className="h-8 w-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-black shrink-0">2</div>
                       <p className="text-sm text-gray-400">Ao completar 10 pontos, você pode resgatar um bônus de R$ 50,00 em créditos.</p>
                    </div>
                    <div className="flex gap-4">
                       <div className="h-8 w-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-black shrink-0">3</div>
                       <p className="text-sm text-gray-400">Os créditos podem ser usados para pagar qualquer serviço futuro na barbearia.</p>
                    </div>
                 </CardContent>
               </Card>
            </div>
          </TabsContent>

          <TabsContent value="finances" className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white/5 border-white/10 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-white">Extrato de Créditos</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      {creditTransactions.length === 0 ? (
                        <p className="text-center py-10 text-gray-500 italic">Nenhuma movimentação de créditos.</p>
                      ) : (
                        creditTransactions.map((tx: any) => (
                          <div key={tx.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                             <div>
                                <p className="text-sm font-bold text-white">{tx.description}</p>
                                <p className="text-[10px] text-gray-500 uppercase">{format(parseISO(tx.created_at), "dd/MM/yyyy HH:mm")}</p>
                             </div>
                             <span className={cn("font-black", tx.type.includes('credit') ? "text-emerald-500" : "text-red-500")}>
                                {tx.type.includes('credit') || tx.type.includes('refund') ? "+" : "-"} R$ {Number(tx.amount).toFixed(2)}
                             </span>
                          </div>
                        ))
                      )}
                   </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-white">Extrato de Cashback</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      {cashbackTransactions.length === 0 ? (
                        <p className="text-center py-10 text-gray-500 italic">Nenhuma movimentação de cashback.</p>
                      ) : (
                        cashbackTransactions.map((tx: any) => (
                          <div key={tx.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                             <div>
                                <p className="text-sm font-bold text-white">{tx.description || (tx.type === 'cashback_earned' ? 'Ganho por Agendamento' : 'Uso em Agendamento')}</p>
                                <p className="text-[10px] text-gray-500 uppercase">{format(parseISO(tx.created_at), "dd/MM/yyyy HH:mm")}</p>
                             </div>
                             <span className={cn("font-black", tx.type === 'cashback_earned' ? "text-[#D4AF37]" : "text-red-500")}>
                                {tx.type === 'cashback_earned' ? "+" : "-"} R$ {Number(tx.amount).toFixed(2)}
                             </span>
                          </div>
                        ))
                      )}
                   </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="profile" className="pt-6">
            <Card className="bg-white/5 border-white/10 shadow-md">
              <CardHeader>
                <CardTitle className="text-white">Meu Perfil</CardTitle>
                <CardDescription className="text-gray-400">Atualize suas informações de contato e foto de perfil.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative group">
                    <div className="h-24 w-24 rounded-full bg-gray-100 overflow-hidden border-2 border-[#D4AF37]">
                      {customerData?.avatar_url ? (
                        <img src={customerData.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-3xl font-bold text-muted-foreground bg-primary/5">
                          {customerData?.name?.[0] || "?"}
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 h-8 w-8 bg-black rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg hover:scale-110 transition-transform">
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
                  <p className="text-xs text-gray-500">Clique no ícone para alterar sua foto</p>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="profile-name" className="text-white">Nome Completo</Label>
                    <Input 
                      id="profile-name" 
                      className="bg-white/5 border-white/10 text-white focus:border-[#D4AF37]"
                      value={customerName || (customerData?.name || "")} 
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-email" className="text-white">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Input 
                        id="profile-email" 
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10 bg-white/5 border-white/10 text-white focus:border-[#D4AF37]"
                        value={customerData?.email || ""}
                        onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-birthdate" className="text-white">Data de Nascimento</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Input 
                        id="profile-birthdate" 
                        type="text"
                        placeholder="dd/mm/aaaa"
                        className="pl-10 bg-white/5 border-white/10 text-white focus:border-[#D4AF37]"
                        value={(() => {
                          const date = customerData?.birth_date || "";
                          if (date.includes("-")) {
                            const [year, month, day] = date.split("-");
                            return `${day}/${month}/${year}`;
                          }
                          return date;
                        })()}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, "");
                          if (value.length > 8) value = value.slice(0, 8);
                          if (value.length > 4) {
                            value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
                          } else if (value.length > 2) {
                            value = `${value.slice(0, 2)}/${value.slice(2)}`;
                          }
                          
                          let isoValue = value;
                          if (value.includes("/") && value.split("/").length === 3) {
                            const [d, m, y] = value.split("/");
                            if (y.length === 4) isoValue = `${y}-${m}-${d}`;
                          }
                          
                          setCustomerData({ ...customerData, birth_date: isoValue });
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-phone" className="text-white">WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Input 
                        id="profile-phone" 
                        value={customerData?.phone || ""} 
                        disabled 
                        className="pl-10 bg-white/10 border-white/5 text-gray-400"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 italic">O número de telefone não pode ser alterado.</p>
                  </div>
                </div>
              </CardContent>
              <CardContent className="pt-0 pb-6">
                <Button 
                  className="w-full gap-2 bg-[#D4AF37] text-black hover:bg-[#B8860B] transition-all duration-300 hover:scale-105 font-bold" 
                  disabled={submitting}
                  onClick={async () => {
                    if (!customerData?.id || !customerName) return;
                    setSubmitting(true);
                    try {
                      const { error } = await supabase
                        .from('customers')
                        .update({ 
                          name: customerName,
                          email: customerData.email,
                          birth_date: customerData.birth_date
                        })
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
        <DialogContent className="sm:max-w-[425px] border-[#D4AF37] border-2">
          <DialogHeader>
            <DialogTitle className="text-black">Alterar Agendamento</DialogTitle>
            <DialogDescription className="text-gray-600">Escolha uma nova data e horário para seu serviço.</DialogDescription>
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
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
                </div>
              ) : availableTimes.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto p-1">
                  {availableTimes.map(time => (
                    <Button
                      key={time}
                      variant={newTime === time ? "default" : "outline"}
                      className={cn(
                        "transition-all duration-300 hover:scale-105",
                        newTime === time ? "bg-black text-white" : "border-gray-200 text-black hover:border-black"
                      )}
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
            <Button onClick={handleUpdateAppointment} disabled={submitting || !newTime} className="bg-black text-white hover:bg-black/90">
              {submitting ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
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
      <AppointmentDetailsModal 
        appointmentId={selectedAppointmentId || undefined}
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        onReschedule={(app) => {
          handleEditAppointment(app);
        }}
        onSuccess={() => {
          if (client?.customer_id) fetchClientData(client.customer_id);
        }}
      />
    </div>
  );
}
