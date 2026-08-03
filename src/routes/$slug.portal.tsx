import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { usePublicModules } from "@/hooks/use-public-modules";
import barbexLogo from "@/assets/logo-barbex.png.asset.json";
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
  AlertCircle,
  Edit2,
  Upload,
  Camera,
  Save,
  Mail,
  Plus,
  QrCode,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Search,
  Gift,
  Info,
  Filter,
  X,
  ShieldCheck,
  Download,
  Trash2,
} from "lucide-react";
import { format, isAfter, subDays, parseISO, addMinutes, differenceInMinutes, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { normalizePhone, formatPhoneMask } from "@/utils/phone";
import { QRCodeSVG } from "qrcode.react";
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { SubscriberPanel } from "@/components/portal/SubscriberPanel";
import { ReviewModal } from "@/components/portal/ReviewModal";
import { emitAutomationEvent } from "@/utils/emit-event";
import { getSubscriptionUsage, categorizeService } from "@/hooks/use-subscription-usage";
import { PremiumHeroCard } from "@/components/portal/premium/PremiumHeroCard";
import { JourneyInsights } from "@/components/portal/premium/JourneyInsights";
import { HomeTab } from "@/components/portal/premium/layout/HomeTab";
import { PortalNavigation } from "@/components/portal/premium/layout/PortalNavigation";
import { AppointmentsTab } from "@/components/portal/premium/tabs/AppointmentsTab";
import { NextAppointmentCard } from "@/components/portal/premium/NextAppointmentCard";
import { PushOptInCard } from "@/components/push/PushOptInCard";
import { PremiumDashboard } from "@/components/portal/premium/PremiumDashboard";
import { MemberDashboard } from "@/components/portal/premium/MemberDashboard";
import { ClubBarbexUpgrade } from "@/components/portal/premium/ClubBarbexUpgrade";
import { LoyaltyTierProgress } from "@/components/portal/premium/LoyaltyTierProgress";
import { WhySubscribeCard } from "@/components/portal/premium/WhySubscribeCard";
import { FloatingUpgradeCTA } from "@/components/portal/premium/FloatingUpgradeCTA";
import { RescheduleWizard } from "@/components/reschedule/RescheduleWizard";

export const Route = createFileRoute("/$slug/portal")({
  component: ClientPortalComponent,
  head: ({ params }) => ({
    meta: [
      { title: "Portal do Cliente — Seus agendamentos e benefícios" },
      {
        name: "description",
        content:
          "Acompanhe seus agendamentos, plano de assinatura, cashback e recompensas de fidelidade da barbearia.",
      },
      { property: "og:title", content: "Portal do Cliente" },
      {
        property: "og:description",
        content: "Agendamentos, assinatura, cashback e fidelidade em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `https://barbex.shop/${params.slug}/portal` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
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
  const { isEnabled: isModuleEnabled } = usePublicModules(shop?.id);
  const loyaltyEnabled = isModuleEnabled("loyalty");
  const cashbackEnabled = isModuleEnabled("cashback");
  const subscriptionsEnabled = isModuleEnabled("subscriptions");
  const [customerData, setCustomerData] = useState<any>(null);
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);
  const [loyaltyRewards, setLoyaltyRewards] = useState<any[]>([]);
  const [_mySubscription, setMySubscription] = useState<any>(null);
  const mySubscription = subscriptionsEnabled ? _mySubscription : null;
  const [cardOpen, setCardOpen] = useState(false);
  const [subRewards, setSubRewards] = useState<any[]>([]);
  const [subRewardsHistory, setSubRewardsHistory] = useState<any[]>([]);
  const [myReferrals, setMyReferrals] = useState<any[]>([]);
  const [subUsageLogs, setSubUsageLogs] = useState<any[]>([]);
  const [subPlanServices, setSubPlanServices] = useState<any[]>([]);
  const [benefitBalances, setBenefitBalances] = useState<any[]>([]);
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
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<any>(null);
  const [refundData, setRefundData] = useState({
    holderName: '',
    pixKey: '',
    pixType: 'cpf',
    notes: ''
  });
  const [creditTransactions, setCreditTransactions] = useState<any[]>([]);
  const [cashbackTransactions, setCashbackTransactions] = useState<any[]>([]);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewAppointment, setReviewAppointment] = useState<any>(null);

  // Benefits tab — filters & modals
  const [benefitSearch, setBenefitSearch] = useState("");
  const [benefitPeriod, setBenefitPeriod] = useState<"all" | "current" | "last30" | "custom">("all");
  const [benefitFrom, setBenefitFrom] = useState("");
  const [benefitTo, setBenefitTo] = useState("");
  const [planDetailsOpen, setPlanDetailsOpen] = useState(false);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);

  async function handleRedeemReward(historyId: string) {
    if (!confirm("Confirmar resgate deste benefício na barbearia?")) return;
    setRedeemingRewardId(historyId);
    const { error } = await supabase.rpc("redeem_subscription_reward" as any, {
      p_history_id: historyId,
      p_notes: "Resgatado pelo cliente via portal",
    });
    setRedeemingRewardId(null);
    if (error) {
      toast.error("Erro ao resgatar: " + error.message);
      return;
    }
    toast.success("Benefício resgatado! Apresente na barbearia.");
    if (client?.customer_id) fetchClientData(client.customer_id);
  }

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

  const [activeTab, setActiveTab] = useState("home");

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
        .select("id, business_name, whatsapp_number, whatsapp_enabled, primary_color, secondary_color, logo_url, slug, scheduling_mode, cashback_enabled, cashback_percentage, address, google_maps_url, free_service_threshold, font_family, font_size, font_color, cashback_type, cashback_fixed_value, cashback_minimum_amount, cashback_expiration_days, loyalty_mode, barbershop_logo_url, opening_date, cancellation_window_hours, barber_can_cancel, barber_can_reschedule, social_links, avatar_url, gallery_images, pix_qr_code_url, loyalty_reward_value, allow_notifications_on_business_phone, plan, effective_plan")
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

      // Fetch loyalty settings (módulo de fidelidade da barbearia)
      const { data: loyaltyCfg } = await supabase
        .from("loyalty_settings" as any)
        .select("*")
        .eq("tenant_id", profile.id)
        .maybeSingle();
      setLoyaltySettings(loyaltyCfg || null);

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

    // Fetch loyalty rewards
    const { data: rewards } = await supabase
      .from("loyalty_rewards" as any)
      .select("*")
      .eq("customer_id", customerId)
      .order("earned_at", { ascending: false });
    setLoyaltyRewards((rewards as any[]) || []);

    // Fetch appointments (with review status)
    const { data: appts } = await supabase
      .from("appointments")
      // Colunas explícitas: os tokens de gestão/cancelamento NÃO são expostos
      // ao papel anônimo (ver migration de hardening da tabela appointments).
      .select(
        "id, user_id, customer_id, barber_id, service_id, start_time, end_time, status, total_price, notes, created_at, payment_status, payment_method, items, refund_requested_at, refund_type, refund_status, original_total, credit_used, pix_amount, barbershop_amount, final_amount, cashback_used, cashback_earned, reminder_sent, confirmation_sent, tenant_id, source, updated_by_type, updated_by_id, coupon_id, coupon_code, discount_amount, subtotal_amount, appointment_group_id, cancel_reason, confirmation_sent_at, reminder_sent_at, updated_at, completed_at, confirmed_at, cancelled_at, cancel_source, cancelled_by, confirmed_by, completed_by, refund_preference, credits_used, amount_paid, confirmation_response_sent_at, cash_amount, credit_card_amount, debit_card_amount, payment_breakdown, customer_action_source, rescheduled_from_id, payment_id, service_amount, group_sequence, paid_at, subscription_id, subscription_plan_id, subscription_covered_amount, extra_amount, tip_amount, products_amount, tip_barber_id, appointment_type, walkin_arrived_at, walkin_started_at, walkin_ticket_number, services(name, price), barbers!appointments_barber_id_fkey(name), appointment_reviews(id)",
      )
      .eq("customer_id", customerId)
      .order("start_time", { ascending: false });

    const apptsWithReview = (appts || []).map((a: any) => ({
      ...a,
      _review_id: Array.isArray(a.appointment_reviews) && a.appointment_reviews.length > 0
        ? a.appointment_reviews[0].id
        : (a.appointment_reviews?.id ?? null),
    }));
    setAppointments(apptsWithReview);
    if (appts) checkAutoCancellation(appts);

    // Fetch sales
    const { data: saleData } = await supabase
      .from("product_sales")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    
    setSales(saleData || []);

    // Fetch assinatura premium ativa
    const { data: subData } = await supabase
      .from("customer_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("customer_id", customerId)
      .in("status", ["active", "trialing", "paused"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMySubscription(subData || null);

    if (subData?.tenant_id) {
      const [{ data: rewardsCfg }, { data: hist }, { data: usageLogs }, { data: planSvcs }] = await Promise.all([
        supabase
          .from("subscription_loyalty_rewards" as any)
          .select("*")
          .eq("tenant_id", subData.tenant_id)
          .eq("active", true)
          .order("months_required", { ascending: true }),
        supabase
          .from("subscription_loyalty_history" as any)
          .select("*")
          .eq("customer_id", customerId)
          .order("granted_at", { ascending: false }),
        supabase
          .from("subscription_usage_logs" as any)
          .select("*, services(name)")
          .eq("customer_id", customerId)
          .eq("subscription_id", subData.id)
          .order("used_at", { ascending: false }),
        supabase
          .from("subscription_plan_services" as any)
          .select("*, services(name, price)")
          .eq("plan_id", subData.plan_id),
      ]);
      setSubRewards((rewardsCfg as any[]) || []);
      setSubRewardsHistory((hist as any[]) || []);
      setSubUsageLogs((usageLogs as any[]) || []);
      setSubPlanServices((planSvcs as any[]) || []);

      // Per-category benefit balance (new system)
      const { data: balances } = await (supabase as any).rpc("get_subscription_benefit_balance", {
        _subscription_id: subData.id,
      });
      setBenefitBalances((balances as any[]) || []);

      const { data: refs } = await supabase
        .from("subscription_referrals" as any)
        .select("*, referred:customers!subscription_referrals_referred_customer_id_fkey(name)")
        .eq("referrer_customer_id", customerId)
        .order("created_at", { ascending: false });
      setMyReferrals((refs as any[]) || []);
    } else {
      setSubRewards([]);
      setSubRewardsHistory([]);
      setSubUsageLogs([]);
      setSubPlanServices([]);
      setBenefitBalances([]);
      setMyReferrals([]);
    }
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

      const { data: service } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", editingAppointment.service_id)
        .single();

      const duration = service?.duration_minutes || 30;
      const endTime = addMinutes(startTime, duration);
      const oldStart = parseISO(editingAppointment.start_time);

      const { data, error } = await supabase.rpc("reschedule_appointment", {
        p_appointment_id: editingAppointment.id,
        p_new_start_time: startTime.toISOString(),
        p_new_end_time: endTime.toISOString(),
        p_changed_by_type: "customer",
        p_source: "customer_portal",
      });

      const response = data as any;
      if (error || !response || !response.success) {
        throw new Error(error?.message || response?.error || "Erro ao reagendar");
      }

      // Dispara automação de reagendamento (cliente/barbeiro/barbearia via fan-out)
      try {
        await emitAutomationEvent({
          tenantId: editingAppointment.tenant_id || shop?.id,
          event: "appointment.rescheduled.by_customer" as any,
          appointmentId: editingAppointment.id,
          customerId: editingAppointment.customer_id,
          extra: {
            old_date: format(oldStart, "dd/MM/yyyy"),
            old_time: format(oldStart, "HH:mm"),
            new_date: format(startTime, "dd/MM/yyyy"),
            new_time: format(startTime, "HH:mm"),
          },
        });
      } catch (evtErr) {
        console.warn("[portal reschedule] emitAutomationEvent falhou", evtErr);
      }

      toast.success("Agendamento alterado com sucesso!");
      setIsEditModalOpen(false);
      fetchClientData(client.customer_id);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao alterar agendamento");
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

  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem(`client_portal_session_${slug}`);
    setIsLoggedIn(false);
    setClient(null);
    toast.success("Sessão encerrada com sucesso");
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
    // Abrir a modal de detalhes em modo customer para que o fluxo seja unificado
    setSelectedAppointmentId(app.id);
    setIsDetailsModalOpen(true);
  };


  // Logic removed as it is now handled by AppointmentDetailsModal


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

          await supabase.rpc('convert_appointment_to_credit', {
            p_appointment_id: app.id,
            p_customer_id: app.customer_id,
            p_tenant_id: app.user_id,
            p_amount: amount
          });

          toast.info(`Agendamento expirado. R$ ${amount.toFixed(2)} foi adicionado aos seus créditos e removido das entradas.`);
        }
      } else {
        await supabase.rpc('cancel_appointment', {
          p_appointment_id: app.id,
          p_cancelled_by: 'system',
          p_source: 'system_auto_cancellation'
        });
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
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
          <h1 className="text-4xl font-black text-gold mb-2 uppercase italic tracking-tighter">Barber<span className="text-white">LM</span></h1>
          <p className="text-white/60 text-xs font-black uppercase tracking-[0.3em]">Portal do Cliente</p>
        </motion.div>

        <Card className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border-none p-2 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-gold via-black to-gold" />
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
                        className="h-14 pl-12 border-gray-100 bg-gray-50 focus:bg-white focus:border-gold focus:ring-gold text-black text-lg font-bold rounded-2xl transition-all"
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
                    inputClassName="!w-full !h-14 !bg-gray-50 !border-gray-100 !focus:bg-white !focus:border-gold !focus:ring-gold !text-black !text-lg !font-bold !rounded-2xl !pl-12 !transition-all"
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
                  className="text-gold hover:text-[#F5C542] transition-all duration-300 font-extrabold border-b-2 border-gold hover:border-[#F5C542] pb-[2px] hover:-translate-y-[1px]" 
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
          className="mt-4 w-full max-w-md h-[52px] bg-[rgba(255,255,255,0.10)] border border-[rgba(212,175,55,0.45)] text-gold hover:bg-gold hover:text-[#000] transition-all duration-300 rounded-[16px] font-extrabold text-[14px] tracking-[1px] uppercase hover:-translate-y-[2px] active:translate-y-0 hover:shadow-[0_10px_25px_rgba(212,175,55,0.25)]" 
          onClick={() => navigate({ to: `/${slug}` })}
        >
          <ChevronLeft className="mr-2" size={18} /> Voltar para a barbearia
        </Button>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black">
      <header className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-[60]">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-3 text-gold">
            <img src={barbexLogo.url} alt="Barbex" className="h-12 sm:h-14 md:h-16 w-auto drop-shadow-[0_0_10px_rgba(212,175,55,0.35)]" />
            <span className="hidden sm:inline">Portal do Cliente</span>
          </h1>
          <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Sair"
                aria-label="Sair"
                className="group h-8 w-8 rounded-full border border-gold/25 bg-white/[0.03] text-gold backdrop-blur transition-all hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut size={14} className="transition-transform group-hover:-translate-x-0.5" />
              </Button>

            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#0A0A0A] border-white/10 backdrop-blur-xl shadow-2xl max-w-[400px]">
              <AlertDialogHeader>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive mb-4 mx-auto">
                  <AlertCircle size={24} />
                </div>
                <AlertDialogTitle className="text-xl font-bold text-center text-white">Deseja realmente sair?</AlertDialogTitle>
                <AlertDialogDescription className="text-center text-muted-foreground pt-2">
                  Sua sessão será encerrada com segurança e você precisará se autenticar novamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-6 flex gap-2">
                <AlertDialogCancel className="flex-1 bg-white/5 hover:bg-white/10 border-white/10 text-white transition-all">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleLogout}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-white border-none shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all"
                >
                  Sair agora
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <PortalNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSubscriber={!!mySubscription}
        subscriptionsEnabled={subscriptionsEnabled}
        storeEnabled={!!products.length}
        couponsEnabled={true}
      />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-32">
        {activeTab === "home" && (
          <div className="space-y-6">
            <NextAppointmentCard
              appointments={appointments}
              shop={shop}
              onReschedule={handleEditAppointment}
              onCancel={handleCancelAppointment}
              onNewAppointment={() => window.dispatchEvent(new CustomEvent('OPEN_BOOKING_MODAL'))}
            />

            <PushOptInCard
              customerPhone={client?.phone ?? null}
              tenantId={shop?.id ?? null}
              audience="customer"
            />

            <HomeTab
              client={client}
              shop={shop}
              customerData={customerData}
              mySubscription={mySubscription}
              appointments={appointments}
              sales={sales}
              loyaltyRewards={loyaltyRewards}
              barbers={barbers}
              products={products}
              subscriptionsEnabled={subscriptionsEnabled}
              onNewAppointment={() => window.dispatchEvent(new CustomEvent('OPEN_BOOKING_MODAL'))}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          </div>
        )}

        {activeTab === "appointments" && (
          <AppointmentsTab 
            appointments={appointments}
            onViewDetails={(id) => {
              setSelectedAppointmentId(id);
              setIsDetailsModalOpen(true);
            }}
            onReview={(app) => {
              setReviewAppointment(app);
              setIsReviewOpen(true);
            }}
          />
        )}




        {/* Panels handled by activeTab */}
        <div className={cn(activeTab === "home" ? "block" : "hidden")}>
          {mySubscription && (
          <SubscriberPanel
            client={client}
            shop={shop}
            slug={slug}
            customerData={customerData}
            mySubscription={mySubscription}
            appointments={appointments}
            subPlanServices={subPlanServices}
            benefitBalances={benefitBalances}
            subRewards={subRewards}
            subRewardsHistory={subRewardsHistory}
            subUsageLogs={subUsageLogs}
            myReferrals={myReferrals}
            onOpenCard={() => setCardOpen(true)}
            onReschedule={handleEditAppointment}
            onCancel={handleCancelAppointment}
            onNewAppointment={() => window.dispatchEvent(new CustomEvent('OPEN_BOOKING_MODAL'))}
          />
          )}
        </div>

        {activeTab === "benefits" && mySubscription && (
          <SubscriberPanel
            client={client}
            shop={shop}
            slug={slug}
            customerData={customerData}
            mySubscription={mySubscription}
            appointments={appointments}
            subPlanServices={subPlanServices}
            benefitBalances={benefitBalances}
            subRewards={subRewards}
            subRewardsHistory={subRewardsHistory}
            subUsageLogs={subUsageLogs}
            myReferrals={myReferrals}
            onOpenCard={() => setCardOpen(true)}
            onReschedule={handleEditAppointment}
            onCancel={handleCancelAppointment}
            onNewAppointment={() => window.dispatchEvent(new CustomEvent('OPEN_BOOKING_MODAL'))}
          />
        )}


        {(activeTab === "home" || activeTab === "club") && !mySubscription && subscriptionsEnabled && (
          <>
            <ClubBarbexUpgrade
              shopId={shop?.id}
              onSubscribe={() => window.dispatchEvent(new CustomEvent('OPEN_SUBSCRIBE_MODAL'))}
            />

            <MemberDashboard
              appointments={appointments}
              sales={sales}
              customerData={customerData}
              loyaltyRewards={loyaltyRewards}
              subscriptionsEnabled
              onSubscribe={() => window.dispatchEvent(new CustomEvent('OPEN_SUBSCRIBE_MODAL'))}
            />

            <LoyaltyTierProgress appointments={appointments} />

            <WhySubscribeCard
              appointments={appointments}
              shopId={shop?.id}
              onSubscribe={() => window.dispatchEvent(new CustomEvent('OPEN_SUBSCRIBE_MODAL'))}
            />
          </>
        )}

        {activeTab === "home" && !mySubscription && !subscriptionsEnabled && (
          <MemberDashboard
            appointments={appointments}
            sales={sales}
            customerData={customerData}
            loyaltyRewards={loyaltyRewards}
          />
        )}

        {mySubscription && false && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

          <Card className="bg-white/5 border-white/10 shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Total de Serviços</CardDescription>
              <CardTitle className="text-2xl font-bold text-white">{appointments.filter(a => a.status === 'completed').length}</CardTitle>
            </CardHeader>
          </Card>
          {loyaltyEnabled && (
          <Card className="bg-white/5 border-white/10 shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Fidelidade</CardDescription>
              <CardTitle className="text-2xl font-bold flex items-center justify-between text-white">
                <span>{customerData?.loyalty_points || 0} / 10</span>
                {customerData?.loyalty_points >= 10 && (
                  <Button size="sm" onClick={handleClaimLoyaltyReward} disabled={submitting} className="h-7 text-[10px] bg-gold hover:bg-[#B8860B] text-white">
                    Resgatar
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          )}
          <Card className="bg-white/5 border-white/10 shadow-md group hover:border-green-500/30 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 group-hover:text-green-500/80 transition-colors uppercase font-bold text-[10px]">SALDO DE CRÉDITOS</CardDescription>
              <CardTitle className="text-2xl font-bold text-green-500">R$ {customerData?.credits ? Number(customerData.credits).toFixed(2) : "0,00"}</CardTitle>
              <div className="flex flex-col gap-0.5 mt-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Créditos Concedidos: R$ {creditTransactions.filter(t => ['earned', 'credit_earned', 'granted', 'manual_added', 'purchase', 'payout', 'reversion', 'refund_credit', 'adjustment_add'].includes(t.type) || t.amount > 0).reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0).toFixed(2)}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Créditos Utilizados: R$ {creditTransactions.filter(t => (['used', 'debit', 'manual_removed'].includes(t.type) || t.amount < 0) && !['reversion', 'refund_credit'].includes(t.type)).reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0).toFixed(2)}</p>
              </div>
            </CardHeader>
          </Card>
          {cashbackEnabled && (
          <Card className="bg-white/5 border-white/10 shadow-md group hover:border-gold/30 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 group-hover:text-gold/80 transition-colors uppercase font-bold text-[10px]">SALDO DE CASHBACK</CardDescription>
              <CardTitle className="text-2xl font-bold text-gold">R$ {customerData?.cashback_balance ? Number(customerData.cashback_balance).toFixed(2) : "0,00"}</CardTitle>
              <div className="flex flex-col gap-0.5 mt-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Cashback Concedido: R$ {cashbackTransactions.filter(t => ['earned', 'cashback_earned', 'granted', 'cashback_refund', 'refunded'].includes(t.type)).reduce((acc, t) => acc + Number(t.amount || 0), 0).toFixed(2)}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Cashback Utilizado: R$ {cashbackTransactions.filter(t => ['used', 'debit', 'expired'].includes(t.type)).reduce((acc, t) => acc + Number(t.amount || 0), 0).toFixed(2)}</p>
              </div>
            </CardHeader>
          </Card>
          )}

          {mySubscription && (() => {
            const isPaused = mySubscription.status === "paused";
            const startedAt = mySubscription.started_at ? new Date(mySubscription.started_at) : new Date(mySubscription.created_at);
            const totalPausedDays = Number(mySubscription.total_paused_days || 0);
            const effectiveMs = Date.now() - startedAt.getTime() - totalPausedDays * 86400000;
            const months = Math.max(0, Math.floor(effectiveMs / (1000 * 60 * 60 * 24 * 30.4375)));
            const grantedIds = new Set(subRewardsHistory.map((h: any) => h.reward_id));
            const next = subRewards.find((r: any) => !grantedIds.has(r.id) && (r.months_required ?? 0) > months);
            const progress = next ? Math.min(100, (months / next.months_required) * 100) : 100;
            return (
              <Card className={cn(
                "shadow-[0_8px_28px_rgba(212,175,55,0.18)] md:col-span-2 lg:col-span-3",
                isPaused
                  ? "bg-gradient-to-br from-blue-500/10 via-black/40 to-black border-blue-500/40"
                  : "bg-gradient-to-br from-gold/10 via-black/40 to-black border-gold/40",
              )}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardDescription className={cn("uppercase font-black text-[10px] tracking-widest", isPaused ? "text-blue-300/80" : "text-gold/80")}>
                        ★ Assinatura Premium
                      </CardDescription>
                      <CardTitle className="text-xl font-black text-white mt-1">
                        {mySubscription.plan?.name ?? "Plano Ativo"}
                      </CardTitle>
                      <p className="text-xs text-gray-400 mt-1">
                        {months} {months === 1 ? "mês" : "meses"} de fidelidade premium
                      </p>
                    </div>
                    <Badge className={cn("font-black uppercase text-[10px]", isPaused ? "bg-blue-400 text-black" : "bg-gold text-black")}>
                      {isPaused ? "Pausada" : "Ativa"}
                    </Badge>
                  </div>
                  {isPaused && (
                    <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-1">
                      <p className="text-sm font-bold text-blue-200">Sua assinatura está pausada</p>
                      {mySubscription.pause_reason && (
                        <p className="text-xs text-gray-300">
                          <span className="text-gray-500">Motivo:</span> {mySubscription.pause_reason}
                        </p>
                      )}
                      {mySubscription.pause_until && (
                        <p className="text-xs text-gray-300">
                          <span className="text-gray-500">Retorno previsto:</span>{" "}
                          {new Date(mySubscription.pause_until).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      <p className="text-[10px] text-blue-300/80 pt-1">
                        Durante a pausa, benefícios e fidelidade premium ficam suspensos.
                      </p>
                    </div>
                  )}
                  {mySubscription.card_token && (
                    <Button
                      onClick={() => setCardOpen(true)}
                      size="sm"
                      className="mt-3 bg-gradient-to-r from-gold to-[#F5D061] hover:from-[#F5D061] hover:to-gold text-black font-black uppercase text-[11px] tracking-widest gap-2 shadow-[0_4px_16px_rgba(212,175,55,0.35)]"
                    >
                      <QrCode className="h-4 w-4" /> Meu Cartão de Assinante
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {next ? (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-bold">
                          Próxima recompensa: <span className="text-gold">{next.description || next.reward_type}</span>
                        </span>
                        <span className="text-gold font-black">
                          {months}/{next.months_required} meses
                        </span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-gold to-[#F5D061] transition-all duration-700"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gold font-bold">
                      Você já desbloqueou todas as recompensas disponíveis. Obrigado pela fidelidade!
                    </p>
                  )}
                  {subRewardsHistory.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">
                        Recompensas conquistadas ({subRewardsHistory.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {subRewardsHistory.slice(0, 6).map((h: any) => (
                          <Badge
                            key={h.id}
                            variant="outline"
                            className="bg-gold/10 text-gold border-gold/40 text-[10px] font-bold"
                          >
                            {h.notes || "Recompensa"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {mySubscription?.referral_code && (() => {
            const code = mySubscription.referral_code as string;
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const link = `${origin}/${slug}/portal?ref=${code}`;
            const confirmed = myReferrals.filter((r) => r.status === "confirmed").length;
            const pending = myReferrals.filter((r) => r.status === "pending").length;
            return (
              <Card className="bg-gradient-to-br from-fuchsia-950/40 via-black/60 to-black/80 border border-fuchsia-500/30 shadow-[0_8px_30px_rgba(217,70,239,0.15)]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-black text-fuchsia-200 uppercase tracking-widest flex items-center gap-2">
                        <Gift className="h-4 w-4" /> Indique e Ganhe
                      </CardTitle>
                      <CardDescription className="text-xs text-fuchsia-300/70 mt-1">
                        Indique amigos e ganhe 1 mês grátis a cada nova assinatura ativada.
                      </CardDescription>
                    </div>
                    <Badge className="bg-fuchsia-500 text-white font-black uppercase text-[10px]">
                      {confirmed} {confirmed === 1 ? "confirmada" : "confirmadas"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-fuchsia-500/30 bg-black/40 p-3">
                    <p className="text-[10px] font-black uppercase text-fuchsia-300/70 tracking-widest mb-1">Seu código</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xl font-black tracking-[0.3em] text-fuchsia-100">{code}</span>
                      <Button
                        size="sm"
                        onClick={() => {
                          navigator.clipboard?.writeText(code);
                          toast.success("Código copiado");
                        }}
                        className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold uppercase text-[10px] h-8"
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-fuchsia-500/20 bg-black/30 p-3">
                    <p className="text-[10px] font-black uppercase text-fuchsia-300/70 tracking-widest mb-1">Link de indicação</p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={link}
                        className="bg-black/60 border-fuchsia-500/20 text-fuchsia-100 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          navigator.clipboard?.writeText(link);
                          toast.success("Link copiado");
                        }}
                        className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold uppercase text-[10px] h-8"
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-fuchsia-500/20 bg-black/30 p-2 text-center">
                      <div className="text-xl font-black text-fuchsia-200">{confirmed}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-fuchsia-300/70">Recompensas ganhas</div>
                    </div>
                    <div className="rounded-lg border border-fuchsia-500/20 bg-black/30 p-2 text-center">
                      <div className="text-xl font-black text-fuchsia-200">{pending}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-fuchsia-300/70">Pendentes</div>
                    </div>
                  </div>
                  {myReferrals.length > 0 && (
                    <div className="pt-2 border-t border-fuchsia-500/20">
                      <p className="text-[10px] font-black uppercase text-fuchsia-300/70 tracking-widest mb-2">Indicações</p>
                      <div className="space-y-1 max-h-32 overflow-auto">
                        {myReferrals.slice(0, 8).map((r) => (
                          <div key={r.id} className="flex items-center justify-between text-xs">
                            <span className="text-fuchsia-100 truncate">{r.referred?.name || "Cliente"}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-bold",
                                r.status === "confirmed"
                                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                                  : r.status === "cancelled"
                                  ? "bg-red-500/10 text-red-300 border-red-500/40"
                                  : "bg-yellow-500/10 text-yellow-300 border-yellow-500/40"
                              )}
                            >
                              {r.status === "confirmed" ? "Confirmada" : r.status === "cancelled" ? "Cancelada" : "Pendente"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>
        )}



        {/* Content sections below controlled by activeTab */}

          {activeTab === "loyalty" && (
            <div className="pt-6">
            {(() => {
              const target = loyaltySettings?.appointments_required ?? 10;
              const current = Math.min(customerData?.loyalty_points || 0, target);
              const remaining = Math.max(0, target - current);
              const dash = 440;
              const offset = dash - (dash * current) / target;
              const benefitText = loyaltySettings?.benefit_description || 'Recompensa de fidelidade';
              const available = loyaltyRewards.filter((r: any) => r.status === 'available');
              const history = loyaltyRewards.filter((r: any) => r.status !== 'available');
              const enabled = loyaltySettings?.enabled !== false;

              if (!enabled) {
                return (
                  <Card className="bg-white/5 border-white/10 shadow-lg">
                    <CardContent className="py-12 text-center text-gray-400">
                      O programa de fidelidade está desativado nesta barbearia.
                    </CardContent>
                  </Card>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white/5 border-white/10 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-white">Programa de Fidelidade</CardTitle>
                      <CardDescription className="text-gray-400">
                        {benefitText} a cada {target} atendimentos.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center py-10">
                      <div className="relative h-40 w-40 flex items-center justify-center">
                        <svg className="h-full w-full rotate-[-90deg]">
                          <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                          <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={dash} strokeDashoffset={offset} className="text-gold transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-black text-white">{current}</span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">de {target} atendimentos</span>
                        </div>
                      </div>
                      {remaining === 0 ? (
                        <div className="mt-8 flex flex-col items-center gap-2">
                          <Badge className="bg-emerald-500 text-white font-bold px-4 py-1 animate-bounce">
                            RECOMPENSA DISPONÍVEL!
                          </Badge>
                          <p className="text-xs text-emerald-400 font-medium text-center px-4">
                            {benefitText}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-8 text-sm text-gray-400 font-medium italic text-center px-4">
                          Falta(m) {remaining} atendimento(s) para você ganhar: <span className="text-gold font-bold">{benefitText}</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-white/10 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-white">Suas Recompensas</CardTitle>
                      <CardDescription className="text-gray-400">Recompensas disponíveis e histórico.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {available.length === 0 && history.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Nenhuma recompensa ainda. Continue agendando!</p>
                      ) : (
                        <>
                          {available.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Disponíveis</p>
                              {available.map((r: any) => (
                                <div key={r.id} className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                  <p className="text-sm font-bold text-white">{r.benefit_description}</p>
                                  {r.expires_at && (
                                    <p className="text-[10px] text-emerald-300/80 uppercase">Válida até {new Date(r.expires_at).toLocaleDateString('pt-BR')}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {history.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Histórico</p>
                              {history.slice(0, 10).map((r: any) => (
                                <div key={r.id} className="p-3 rounded-lg bg-white/5 border border-white/10 flex justify-between items-center">
                                  <div>
                                    <p className="text-sm text-white">{r.benefit_description}</p>
                                    <p className="text-[10px] text-gray-500 uppercase">
                                      {r.status === 'redeemed' ? `Usada em ${new Date(r.redeemed_at).toLocaleDateString('pt-BR')}` : r.status === 'expired' ? 'Expirada' : r.status}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className={r.status === 'redeemed' ? 'border-emerald-500/40 text-emerald-400' : 'border-gray-500/40 text-gray-400'}>
                                    {r.status === 'redeemed' ? 'Usada' : r.status === 'expired' ? 'Expirada' : r.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
            </div>
          )}


          {mySubscription && activeTab === "benefits" && (
            <div className="pt-6">
            {(() => {
              const plan = mySubscription.plan;
              const usage = getSubscriptionUsage(mySubscription, subPlanServices, subUsageLogs);
              const nextBilling = usage.renewal_date;
              const periodStart = usage.cycle_start;
              // Aliases for the plan details modal below
              const usedThisPeriod = usage.total_uses_consumed;
              const maxUses = usage.has_limits ? usage.total_uses_allowed : 0;
              const totalCovered = usage.usage_history.reduce((s, e) => s + e.covered_amount, 0);

              // Per-service price lookup (from plan services) for economy calc
              const priceByCategory: Record<string, number> = { haircut: 0, beard: 0 };
              for (const ps of subPlanServices) {
                const cat = categorizeService(ps?.services?.name);
                const price = Number(ps?.services?.price || 0);
                if (cat === "haircut") priceByCategory.haircut = Math.max(priceByCategory.haircut, price);
                else if (cat === "beard") priceByCategory.beard = Math.max(priceByCategory.beard, price);
                else if (cat === "both") {
                  // Combo: split evenly if no individual price exists
                  if (priceByCategory.haircut === 0) priceByCategory.haircut = price / 2;
                  if (priceByCategory.beard === 0) priceByCategory.beard = price / 2;
                }
              }

              // Economy = sum of (haircut_used * haircut_price + beard_used * beard_price) from cycle history
              const economyCalculated = usage.usage_history.reduce(
                (s, e) => s + e.haircut_consumed * priceByCategory.haircut + e.beard_consumed * priceByCategory.beard,
                0,
              );
              const fallbackCovered = usage.usage_history.reduce((s, e) => s + e.covered_amount, 0);
              const economyValue = economyCalculated > 0 ? economyCalculated : fallbackCovered;

              // Search filter for history
              const filteredHistory = usage.usage_history.filter((entry) => {
                if (!benefitSearch.trim()) return true;
                return entry.service_name.toLowerCase().includes(benefitSearch.toLowerCase());
              });
              const filteredEconomy = filteredHistory.reduce(
                (s, e) => s + e.haircut_consumed * priceByCategory.haircut + e.beard_consumed * priceByCategory.beard,
                0,
              );

              // Per-service used calculations (Combo consumes haircut + beard)
              const serviceUsage = subPlanServices.map((ps: any) => {
                const cat = categorizeService(ps?.services?.name);
                const allowed = Number(ps?.max_uses_per_period || 0);
                let used = 0;
                if (cat === "haircut") used = usage.haircut_used;
                else if (cat === "beard") used = usage.beard_used;
                else if (cat === "both") used = 0; // Combo has no independent counter
                const remaining = Math.max(0, allowed - used);
                return { ps, cat, allowed, used, remaining };
              });

              const pendingRewards = subRewardsHistory.filter((h: any) => h.status === "pending");
              const redeemedRewards = subRewardsHistory.filter((h: any) => h.status === "redeemed");
              const pendingRewardsAll = pendingRewards;
              const startedAt = mySubscription.started_at ? new Date(mySubscription.started_at) : new Date(mySubscription.created_at);
              const monthsActive = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)));
              const nextRewardCfg = subRewards
                .filter((r: any) => Number(r.months_required || 0) > monthsActive)
                .sort((a: any, b: any) => Number(a.months_required) - Number(b.months_required))[0];
              const nextRewardProgress = nextRewardCfg
                ? Math.min(100, (monthsActive / Number(nextRewardCfg.months_required)) * 100)
                : 100;

              const totalPct = usage.has_limits ? Math.min(100, (usage.total_uses_consumed / usage.total_uses_allowed) * 100) : 100;

              return (
                <div className="space-y-6">
                  {/* Premium Dashboard - 4 cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card
                      className="bg-gradient-to-br from-gold/25 via-gold/10 to-transparent border-gold/40 shadow-[0_8px_30px_rgba(212,175,55,0.15)] cursor-pointer hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(212,175,55,0.25)] transition-all"
                      onClick={() => setPlanDetailsOpen(true)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardDescription className="text-gold uppercase text-[10px] font-black tracking-widest">Plano Atual</CardDescription>
                          <Info size={14} className="text-gold" />
                        </div>
                        <CardTitle className="text-white text-lg leading-tight">{usage.plan_name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-black text-white">R$ {Number(plan?.monthly_price || 0).toFixed(2)}<span className="text-[10px] text-gray-400 font-normal">/mês</span></p>
                        {nextBilling && (
                          <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider">Renovação: {format(nextBilling, "dd/MM/yyyy", { locale: ptBR })}</p>
                        )}
                        <p className="text-[10px] text-gold mt-1 uppercase font-bold tracking-wider">Ver detalhes ›</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10 shadow-lg hover:border-white/20 transition-colors">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-gray-400 uppercase text-[10px] font-black tracking-widest">Benefícios do Período</CardDescription>
                        <CardTitle className="text-white text-lg">
                          {usage.has_limits ? (
                            <>{usage.total_uses_consumed} / {usage.total_uses_allowed} <span className="text-xs text-gray-400 font-normal">utilizações</span></>
                          ) : (
                            <>{usage.total_uses_consumed} <span className="text-xs text-gray-400 font-normal">utilizações</span></>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {usage.has_limits ? (
                          <>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-gold to-[#B8941F] transition-all" style={{ width: `${totalPct}%` }} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider">
                              {usage.total_uses_consumed} de {usage.total_uses_allowed} consumidas
                            </p>
                            <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">{usage.total_uses_remaining} restantes</p>
                          </>
                        ) : (
                          <>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 w-full" />
                            </div>
                            <p className="text-[10px] text-emerald-400 mt-2 uppercase font-bold tracking-wider">Ilimitado</p>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-emerald-500/15 to-transparent border-emerald-500/30 shadow-lg">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-emerald-400 uppercase text-[10px] font-black tracking-widest">Economia Obtida</CardDescription>
                        <CardTitle className="text-emerald-400 text-2xl font-black">R$ {economyValue.toFixed(2)}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                          Ciclo atual • {usage.haircut_used} corte(s) + {usage.beard_used} barba(s)
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-gold/15 to-purple-500/5 border-gold/30 shadow-lg">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardDescription className="text-gold uppercase text-[10px] font-black tracking-widest">Próxima Recompensa</CardDescription>
                          <Gift size={14} className="text-gold" />
                        </div>
                        <CardTitle className="text-white text-base leading-tight line-clamp-2">
                          {pendingRewardsAll.length > 0
                            ? "Resgate disponível!"
                            : nextRewardCfg?.description || "Tudo em dia ✦"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {pendingRewardsAll.length > 0 ? (
                          <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">{pendingRewardsAll.length} pendente(s) — vá em Benefícios para resgatar</p>
                        ) : nextRewardCfg ? (
                          <>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-gold to-[#B8941F] transition-all" style={{ width: `${nextRewardProgress}%` }} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider">
                              Faltam {Math.max(0, Number(nextRewardCfg.months_required) - monthsActive)} mes(es) • {monthsActive} / {nextRewardCfg.months_required}
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Você já alcançou todas as recompensas premium.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recompensas para resgatar */}
                  {(pendingRewards.length > 0 || redeemedRewards.length > 0) && (
                    <Card className="bg-gradient-to-br from-gold/10 to-transparent border-gold/30 shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Gift className="text-gold" size={20} />
                          Benefícios para Resgatar
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                          Conquistas por tempo de assinatura
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {pendingRewards.length === 0 ? (
                          <p className="text-center py-6 text-gray-500 italic text-sm">Nenhum benefício pendente — você já resgatou todos!</p>
                        ) : (
                          <div className="space-y-3">
                            {pendingRewards.map((r: any) => {
                              const cfg = subRewards.find((c: any) => c.id === r.reward_id);
                              return (
                                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-black/30 border border-gold/30 rounded-xl">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-gold/20 flex items-center justify-center shrink-0">
                                      <Gift className="text-gold h-5 w-5" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-white">{cfg?.description || "Recompensa"}</p>
                                      <p className="text-[10px] text-gray-400 uppercase">
                                        Concedido em {format(parseISO(r.granted_at), "dd/MM/yyyy", { locale: ptBR })}
                                        {cfg?.months_required ? ` • ${cfg.months_required} meses` : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() => handleRedeemReward(r.id)}
                                    disabled={redeemingRewardId === r.id}
                                    className="bg-gold hover:bg-[#B8941F] text-black font-bold shrink-0"
                                  >
                                    {redeemingRewardId === r.id ? "Resgatando..." : "Resgatar"}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {redeemedRewards.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-white/10">
                            <p className="text-xs uppercase text-gray-500 font-bold mb-3">Já resgatados</p>
                            <div className="space-y-2">
                              {redeemedRewards.map((r: any) => {
                                const cfg = subRewards.find((c: any) => c.id === r.reward_id);
                                return (
                                  <div key={r.id} className="flex items-center justify-between py-2 text-xs">
                                    <span className="text-white flex items-center gap-2">
                                      <CheckCircle2 className="text-emerald-400" size={14} />
                                      {cfg?.description || "Recompensa"}
                                    </span>
                                    <span className="text-gray-500 uppercase text-[10px]">
                                      {r.redeemed_at ? format(parseISO(r.redeemed_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Serviços inclusos com contadores reais */}
                  <Card className="bg-white/5 border-white/10 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-white">Serviços Inclusos</CardTitle>
                      <CardDescription className="text-gray-400">Consumo real do ciclo atual</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {serviceUsage.length === 0 ? (
                        <p className="text-center py-8 text-gray-500 italic">Nenhum serviço específico vinculado a este plano.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {serviceUsage.map(({ ps, cat, allowed, used, remaining }) => {
                            const pct = allowed > 0 ? Math.min(100, (used / allowed) * 100) : 0;
                            const isCombo = cat === "both";
                            return (
                              <div key={ps.id} className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-9 w-9 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                                      <CheckCircle2 className="text-gold h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-white truncate">{ps.services?.name || "Serviço"}</p>
                                      {isCombo ? (
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Consome: 1 corte + 1 barba</p>
                                      ) : (
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                                          {allowed > 0 ? `${used} / ${allowed} usado(s) • ${remaining} restante(s)` : "Ilimitado"}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {ps.services?.price && (
                                    <span className="text-[10px] text-gray-400 line-through shrink-0">R$ {Number(ps.services.price).toFixed(2)}</span>
                                  )}
                                </div>
                                {!isCombo && allowed > 0 && (
                                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-gold to-[#B8941F] transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                                {isCombo && (
                                  <p className="text-[10px] text-gray-500 italic">Sem contador próprio — usa cortes + barbas</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Histórico de uso em tabela */}
                  <Card className="bg-white/5 border-white/10 shadow-lg">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <CardTitle className="text-white">Histórico de Uso</CardTitle>
                          <CardDescription className="text-gray-400">
                            {filteredHistory.length} atendimento(s) concluído(s) • Economia: <span className="text-emerald-400 font-bold">R$ {filteredEconomy.toFixed(2)}</span>
                          </CardDescription>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <Input
                            placeholder="Buscar serviço..."
                            value={benefitSearch}
                            onChange={(e) => setBenefitSearch(e.target.value)}
                            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                          />
                          {benefitSearch && (
                            <button
                              type="button"
                              onClick={() => setBenefitSearch("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {filteredHistory.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                          <History size={40} className="mx-auto mb-3 opacity-20" />
                          <p className="italic">Nenhum atendimento concluído no ciclo atual.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto -mx-2">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-white/10">
                                <th className="text-left py-2 px-2 font-bold">Data</th>
                                <th className="text-left py-2 px-2 font-bold">Serviço</th>
                                <th className="text-left py-2 px-2 font-bold">Consumo</th>
                                <th className="text-right py-2 px-2 font-bold">Economia</th>
                                <th className="text-right py-2 px-2 font-bold">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredHistory.map((entry) => {
                                const saved = entry.haircut_consumed * priceByCategory.haircut + entry.beard_consumed * priceByCategory.beard;
                                const consumeDesc = entry.category === "both"
                                  ? "1 corte + 1 barba"
                                  : entry.category === "haircut"
                                  ? "1 corte"
                                  : entry.category === "beard"
                                  ? "1 barba"
                                  : `${entry.total_consumed} utilização`;
                                return (
                                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-2 text-gray-300 whitespace-nowrap">
                                      {entry.used_at ? format(parseISO(entry.used_at), "dd/MM", { locale: ptBR }) : "—"}
                                    </td>
                                    <td className="py-3 px-2 text-white font-medium">{entry.service_name}</td>
                                    <td className="py-3 px-2 text-gray-400 text-xs">{consumeDesc}</td>
                                    <td className="py-3 px-2 text-right text-emerald-400 font-bold whitespace-nowrap">R$ {saved.toFixed(2)}</td>
                                    <td className="py-3 px-2 text-right">
                                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
                                        Concluído
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Modal compatibility aliases */}



                  {/* Modal de detalhes do plano */}
                  <Dialog open={planDetailsOpen} onOpenChange={setPlanDetailsOpen}>
                    <DialogContent className="max-w-lg bg-zinc-950 border-white/10 text-white max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-gold flex items-center gap-2">
                          <Info size={18} /> Detalhes do Plano {plan?.name}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                          Saldo, economia e regras que justificam seus benefícios.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 mt-2">
                        {plan?.description && (
                          <p className="text-sm text-gray-300 italic border-l-2 border-gold/40 pl-3">{plan.description}</p>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-[10px] uppercase text-gray-400">Mensalidade</p>
                            <p className="text-lg font-black text-white">R$ {Number(plan?.monthly_price || 0).toFixed(2)}</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-[10px] uppercase text-gray-400">Economia total</p>
                            <p className="text-lg font-black text-emerald-400">R$ {totalCovered.toFixed(2)}</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-[10px] uppercase text-gray-400">Usos no período</p>
                            <p className="text-lg font-black text-white">{usedThisPeriod}{maxUses ? ` / ${maxUses}` : " (ilim.)"}</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-[10px] uppercase text-gray-400">Atendimentos cobertos</p>
                            <p className="text-lg font-black text-white">{subUsageLogs.length}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs uppercase text-gray-400 font-bold mb-2">Regras e Benefícios</p>
                          <ul className="space-y-2 text-sm">
                            {plan?.participates_traditional_loyalty && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Acumula fidelidade tradicional</li>
                            )}
                            {plan?.participates_cashback && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Ganha cashback em compras</li>
                            )}
                            {plan?.accumulates_premium_loyalty && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Acumula tempo para recompensas premium</li>
                            )}
                            {plan?.allows_product_discount && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Desconto em produtos</li>
                            )}
                            {plan?.agenda_priority && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Prioridade na agenda</li>
                            )}
                            {plan?.exclusive_hours && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Horários exclusivos</li>
                            )}
                            {plan?.exclusive_days && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Dias exclusivos</li>
                            )}
                            {plan?.preferential_service && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Atendimento preferencial</li>
                            )}
                            {maxUses && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Limite de {maxUses} usos por mês</li>
                            )}
                            {!maxUses && (
                              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Usos ilimitados no período</li>
                            )}
                          </ul>
                        </div>

                        {subPlanServices.length > 0 && (
                          <div>
                            <p className="text-xs uppercase text-gray-400 font-bold mb-2">Serviços inclusos</p>
                            <div className="space-y-1.5">
                              {subPlanServices.map((ps: any) => (
                                <div key={ps.id} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5">
                                  <span className="text-white">{ps.services?.name}</span>
                                  <span className="text-gray-400 text-xs">
                                    {ps.services?.price ? `R$ ${Number(ps.services.price).toFixed(2)} ` : ""}
                                    {ps.max_uses_per_period ? `(${ps.max_uses_per_period}x/mês)` : "(ilim.)"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                          <p className="text-xs text-gray-300">
                            Você pagou <span className="font-bold text-white">R$ {Number(plan?.monthly_price || 0).toFixed(2)}</span> e já economizou{" "}
                            <span className="font-bold text-emerald-400">R$ {totalCovered.toFixed(2)}</span> em atendimentos cobertos pelo plano.
                          </p>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button onClick={() => setPlanDetailsOpen(false)} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                          Fechar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                );
              })()}
            </div>
          )}


          {mySubscription && activeTab === "card" && (
            <div className="pt-6">
            {(() => {
              const status = mySubscription.status as string;
              const isActive = status === "active";
              const isPaused = status === "paused";
              const statusLabel = isActive ? "ATIVO" : isPaused ? "PAUSADO" : status === "canceled" ? "CANCELADO" : "INATIVO";
              const statusColor = isActive ? "bg-emerald-500 text-black" : isPaused ? "bg-blue-400 text-black" : "bg-red-500 text-white";
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              const qrUrl = mySubscription.card_token ? `${origin}/subscription-card/validate/${mySubscription.card_token}` : "";
              const planName = mySubscription.plan?.name ?? "Assinatura Premium";
              const validUntil = mySubscription.current_period_end
                ? new Date(mySubscription.current_period_end).toLocaleDateString("pt-BR")
                : "—";
              return (
                <div className="max-w-sm mx-auto">
                  <div className="relative rounded-3xl overflow-hidden border-2 border-gold/70 bg-gradient-to-br from-[#0a0a0a] via-[#1a1408] to-[#0a0a0a] p-6 shadow-[0_20px_60px_rgba(212,175,55,0.35)]">
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                      style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #D4AF37 1px, transparent 1px), radial-gradient(circle at 80% 80%, #D4AF37 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                    <div className="relative flex items-start justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80 font-black">Carteirinha Premium</p>
                        <p className="text-xs text-gray-400 mt-1">{planName}</p>
                      </div>
                      <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", statusColor)}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="relative flex items-center gap-3 mt-5">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-gold to-[#8a6d12] grid place-items-center text-black font-black text-xl overflow-hidden border border-gold">
                        {client?.avatar_url ? (
                          <img src={client.avatar_url} alt={client?.name} className="h-full w-full object-cover" />
                        ) : (
                          (client?.name || "?").charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-black text-lg truncate">{client?.name || "Cliente"}</p>
                        <p className="text-[11px] text-gold/80 uppercase tracking-widest">Assinante Premium</p>
                      </div>
                    </div>
                    {qrUrl ? (
                      <div className="relative mt-6 bg-white rounded-2xl p-4 grid place-items-center">
                        <QRCodeSVG value={qrUrl} size={200} level="H" bgColor="#ffffff" fgColor="#0a0a0a" />
                      </div>
                    ) : (
                      <div className="relative mt-6 bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-xs text-gray-400">
                        QR Code indisponível para esta assinatura.
                      </div>
                    )}
                    <div className="relative mt-4 grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <p className="text-gray-500 uppercase tracking-widest">Válido até</p>
                        <p className="text-white font-bold">{validUntil}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 uppercase tracking-widest">Usos no mês</p>
                        <p className="text-white font-bold">
                          {mySubscription.uses_this_period || 0}
                          {mySubscription.plan?.max_uses_per_month ? `/${mySubscription.plan.max_uses_per_month}` : ""}
                        </p>
                      </div>
                    </div>
                    <p className="relative mt-4 text-center text-[10px] text-gray-500">
                      Apresente este QR Code na barbearia para validar seus benefícios.
                    </p>
                  </div>
                </div>
              );
            })()}
            </div>
          )}

          {mySubscription && activeTab === "club" && (
            <div className="pt-6">
            {(() => {
              const plan = mySubscription.plan;
              const startedAt = mySubscription.started_at ? new Date(mySubscription.started_at) : new Date(mySubscription.created_at);
              const monthsActive = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)));
              const totalCovered = subUsageLogs.reduce((s: number, l: any) => s + Number(l.covered_amount || 0), 0);
              const redeemedCount = subRewardsHistory.filter((h: any) => h.status === "redeemed").length;
              const referralsConverted = myReferrals.filter((r: any) => r.status === "converted" || r.converted_at).length;
              return (
                <div className="space-y-6">
                  <Card className="bg-gradient-to-br from-gold/20 via-[#1a1408] to-black border-gold/40 shadow-[0_20px_60px_rgba(212,175,55,0.2)] overflow-hidden relative">
                    <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
                      style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #D4AF37 1px, transparent 1px), radial-gradient(circle at 80% 80%, #D4AF37 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                    <CardHeader className="relative">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-gold to-[#8a6d12] grid place-items-center text-black">
                          <Gift size={22} />
                        </div>
                        <div>
                          <CardDescription className="text-gold uppercase text-[10px] font-black tracking-widest">Clube VIP</CardDescription>
                          <CardTitle className="text-white text-2xl">Bem-vindo, {client?.name?.split(" ")[0] || "Assinante"}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-black/40 border border-gold/20 rounded-xl p-3">
                          <p className="text-[9px] uppercase text-gray-500 tracking-widest font-bold">Tempo VIP</p>
                          <p className="text-xl font-black text-white mt-1">{monthsActive}<span className="text-xs text-gray-400 font-normal"> {monthsActive === 1 ? "mês" : "meses"}</span></p>
                        </div>
                        <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-3">
                          <p className="text-[9px] uppercase text-gray-500 tracking-widest font-bold">Economia</p>
                          <p className="text-xl font-black text-emerald-400 mt-1">R$ {totalCovered.toFixed(0)}</p>
                        </div>
                        <div className="bg-black/40 border border-gold/20 rounded-xl p-3">
                          <p className="text-[9px] uppercase text-gray-500 tracking-widest font-bold">Recompensas</p>
                          <p className="text-xl font-black text-white mt-1">{redeemedCount}</p>
                        </div>
                        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-3">
                          <p className="text-[9px] uppercase text-gray-500 tracking-widest font-bold">Indicações</p>
                          <p className="text-xl font-black text-white mt-1">{referralsConverted}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-white/10 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <CheckCircle2 className="text-gold" size={20} />
                        Vantagens Exclusivas
                      </CardTitle>
                      <CardDescription className="text-gray-400">Benefícios que só assinantes têm acesso</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-300">
                        {plan?.agenda_priority && (
                          <li className="flex items-start gap-2 p-3 bg-white/5 rounded-lg border border-white/10"><CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" /> Prioridade na agenda</li>
                        )}
                        {plan?.exclusive_hours && (
                          <li className="flex items-start gap-2 p-3 bg-white/5 rounded-lg border border-white/10"><CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" /> Horários exclusivos</li>
                        )}
                        {plan?.exclusive_days && (
                          <li className="flex items-start gap-2 p-3 bg-white/5 rounded-lg border border-white/10"><CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" /> Dias exclusivos</li>
                        )}
                        {plan?.preferential_service && (
                          <li className="flex items-start gap-2 p-3 bg-white/5 rounded-lg border border-white/10"><CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" /> Atendimento preferencial</li>
                        )}
                        {plan?.allows_product_discount && (
                          <li className="flex items-start gap-2 p-3 bg-white/5 rounded-lg border border-white/10"><CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" /> Desconto em produtos</li>
                        )}
                        {plan?.accumulates_premium_loyalty && (
                          <li className="flex items-start gap-2 p-3 bg-white/5 rounded-lg border border-white/10"><CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" /> Acumula recompensas premium</li>
                        )}
                        {plan?.participates_cashback && (
                          <li className="flex items-start gap-2 p-3 bg-white/5 rounded-lg border border-white/10"><CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" /> Cashback em compras</li>
                        )}
                        {!plan?.agenda_priority && !plan?.exclusive_hours && !plan?.exclusive_days && !plan?.preferential_service && !plan?.allows_product_discount && (
                          <li className="text-gray-500 italic text-xs col-span-2">Consulte sua barbearia sobre vantagens adicionais do seu plano.</li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>

                  {mySubscription.referral_code && (
                    <Card className="bg-gradient-to-br from-purple-500/10 to-gold/5 border-purple-500/30 shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-white">Indique e ganhe</CardTitle>
                        <CardDescription className="text-gray-400">Compartilhe seu código VIP e ganhe vantagens</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between gap-3 p-4 bg-black/40 border border-gold/30 rounded-xl">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Seu código</p>
                            <p className="text-2xl font-black text-gold tracking-widest">{mySubscription.referral_code}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(mySubscription.referral_code);
                              toast.success("Código copiado!");
                            }}
                            className="bg-gold hover:bg-[#B8941F] text-black font-bold"
                          >
                            Copiar
                          </Button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 uppercase tracking-wider">
                          {referralsConverted} indicação(ões) convertida(s)
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()}
            </div>
          )}



          {/* Finances tab */}
          {activeTab === "finances" && (
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
                             <div className="flex-1 mr-3">
                                <p className="text-sm font-bold text-white">{tx.description || (tx.type === 'reversion' ? 'Crédito Devolvido' : 'Crédito Adicionado')}</p>
                                <p className="text-[10px] text-gray-500 uppercase">{format(parseISO(tx.created_at), "dd/MM/yyyy HH:mm")}</p>
                             </div>
                             <span className={cn(
                               "font-black text-sm shrink-0", 
                               (tx.type === 'reversion' || tx.type === 'credit_granted' || tx.type === 'refund_credit' || tx.type === 'adjustment_add' || tx.amount > 0) 
                                 ? "text-emerald-500" 
                                 : "text-red-500"
                             )}>
                                {(tx.type === 'reversion' || tx.type === 'credit_granted' || tx.type === 'refund_credit' || tx.type === 'adjustment_add' || tx.amount > 0) ? "+" : "-"} R$ {Math.abs(Number(tx.amount)).toFixed(2)}
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
                             <span className={cn("font-black", tx.type === 'cashback_earned' ? "text-gold" : "text-red-500")}>
                                {tx.type === 'cashback_earned' ? "+" : "-"} R$ {Number(tx.amount).toFixed(2)}
                             </span>
                          </div>
                        ))
                      )}
                   </div>
                </CardContent>
              </Card>
            </div>
          )}

          
          {activeTab === "profile" && (
            <Card className="bg-white/5 border-white/10 shadow-md">
              <CardHeader>
                <CardTitle className="text-white">Meu Perfil</CardTitle>
                <CardDescription className="text-gray-400">Atualize suas informações de contato e foto de perfil.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative group">
                    <div className="h-24 w-24 rounded-full bg-gray-100 overflow-hidden border-2 border-gold">
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
                      className="bg-white/5 border-white/10 text-white focus:border-gold"
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
                        className="pl-10 bg-white/5 border-white/10 text-white focus:border-gold"
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
                        className="pl-10 bg-white/5 border-white/10 text-white focus:border-gold"
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
                  className="w-full gap-2 bg-gold text-black hover:bg-[#B8860B] transition-all duration-300 hover:scale-105 font-bold" 
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
          )}
          {activeTab === "privacy" && (
            <PrivacyPanel customerData={customerData} appointments={appointments} />
          )}
        </main>




      {!mySubscription && subscriptionsEnabled && (
        <FloatingUpgradeCTA
          onSubscribe={() => window.dispatchEvent(new CustomEvent('OPEN_SUBSCRIBE_MODAL'))}
        />
      )}



      <RescheduleWizard
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        appointment={
          editingAppointment
            ? {
                id: editingAppointment.id,
                tenant_id: editingAppointment.tenant_id || shop?.id,
                customer_id: editingAppointment.customer_id || client?.customer_id,
                customer_name: editingAppointment.customer_name || client?.name,
                customer_phone: editingAppointment.customer_phone || client?.phone,
                service_id: editingAppointment.service_id,
                service_name: editingAppointment.service_name || editingAppointment.services?.name,
                service_price: editingAppointment.total_price || editingAppointment.services?.price,
                payment_method: editingAppointment.payment_method,
                barber_id: editingAppointment.barber_id,
                barber_name: editingAppointment.barber_name || editingAppointment.barbers?.name,
                start_time: editingAppointment.start_time,
                end_time: editingAppointment.end_time,
                management_token: editingAppointment.management_token,
                appointment_group_id: editingAppointment.appointment_group_id,
              }
            : null
        }
        actor="customer"
        actorId={client?.customer_id}
        actorName={client?.name}
        source="customer_portal"
        onSuccess={() => {
          if (client?.customer_id) fetchClientData(client.customer_id);
        }}
      />

      {/* Refund dialog logic moved to AppointmentDetailsModal for consistency */}

      <AppointmentDetailsModal 
        appointmentId={selectedAppointmentId || undefined}
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        mode="customer"
        onReschedule={(app) => {
          handleEditAppointment(app);
        }}
        onSuccess={() => {
          if (client?.customer_id) fetchClientData(client.customer_id);
        }}
      />

      <ReviewModal
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        appointment={reviewAppointment}
        tenantId={shop?.id}
        onSubmitted={() => { if (client?.customer_id) fetchClientData(client.customer_id); }}
      />

      {/* CARTÃO DIGITAL DO ASSINANTE */}
      {mySubscription?.card_token && (
        <Dialog open={cardOpen} onOpenChange={setCardOpen}>
          <DialogContent className="max-w-sm bg-transparent border-none p-0 shadow-none">
            <DialogTitle className="sr-only">Cartão Digital do Assinante</DialogTitle>
            {(() => {
              const status = mySubscription.status as string;
              const isActive = status === "active";
              const isPaused = status === "paused";
              const statusLabel = isActive ? "ATIVO" : isPaused ? "PAUSADO" : status === "canceled" ? "CANCELADO" : "INATIVO";
              const statusColor = isActive ? "bg-emerald-500 text-black" : isPaused ? "bg-blue-400 text-black" : "bg-red-500 text-white";
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              const qrUrl = `${origin}/subscription-card/validate/${mySubscription.card_token}`;
              const planName = mySubscription.plan?.name ?? "Assinatura Premium";
              const validUntil = mySubscription.current_period_end
                ? new Date(mySubscription.current_period_end).toLocaleDateString("pt-BR")
                : "—";
              return (
                <div className="relative rounded-3xl overflow-hidden border-2 border-gold/70 bg-gradient-to-br from-[#0a0a0a] via-[#1a1408] to-[#0a0a0a] p-6 shadow-[0_20px_60px_rgba(212,175,55,0.35)]">
                  <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #D4AF37 1px, transparent 1px), radial-gradient(circle at 80% 80%, #D4AF37 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80 font-black">Cartão Premium</p>
                      <p className="text-xs text-gray-400 mt-1">{planName}</p>
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", statusColor)}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="relative flex items-center gap-3 mt-5">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-gold to-[#8a6d12] grid place-items-center text-black font-black text-xl overflow-hidden border border-gold">
                      {client?.avatar_url ? (
                        <img src={client.avatar_url} alt={client?.name} className="h-full w-full object-cover" />
                      ) : (
                        (client?.name || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-black text-lg truncate">{client?.name || "Cliente"}</p>
                      <p className="text-[11px] text-gold/80 uppercase tracking-widest">Assinante Premium</p>
                    </div>
                  </div>
                  <div className="relative mt-6 bg-white rounded-2xl p-4 grid place-items-center">
                    <QRCodeSVG value={qrUrl} size={200} level="H" bgColor="#ffffff" fgColor="#0a0a0a" />
                  </div>
                  <div className="relative mt-4 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <p className="text-gray-500 uppercase tracking-widest">Válido até</p>
                      <p className="text-white font-bold">{validUntil}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 uppercase tracking-widest">Usos no mês</p>
                      <p className="text-white font-bold">
                        {mySubscription.uses_this_period || 0}
                        {mySubscription.plan?.max_uses_per_month ? `/${mySubscription.plan.max_uses_per_month}` : ""}
                      </p>
                    </div>
                  </div>
                  <p className="relative mt-4 text-center text-[10px] text-gray-500">
                    Apresente este QR Code na barbearia para validar seus benefícios.
                  </p>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

function PrivacyPanel({ customerData, appointments }: { customerData: any; appointments: any[] }) {
  const [allowMarketing, setAllowMarketing] = useState<boolean>(!!customerData?.allow_marketing);
  const [allowNotifications, setAllowNotifications] = useState<boolean>(customerData?.allow_notifications !== false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const deletionPending = !!customerData?.deletion_requested_at;

  useEffect(() => {
    setAllowMarketing(!!customerData?.allow_marketing);
    setAllowNotifications(customerData?.allow_notifications !== false);
  }, [customerData?.id]);

  const savePreferences = async () => {
    if (!customerData?.id) return;
    setSavingPrefs(true);
    const { error } = await supabase
      .from('customers')
      .update({ allow_marketing: allowMarketing, allow_notifications: allowNotifications })
      .eq('id', customerData.id);
    setSavingPrefs(false);
    if (error) {
      toast.error('Não foi possível salvar suas preferências.');
    } else {
      toast.success('Preferências atualizadas.');
    }
  };

  const exportData = async () => {
    if (!customerData?.id) return;
    try {
      const [consentsRes, txRes, cashbackRes, creditsRes] = await Promise.all([
        supabase.from('privacy_consents').select('*').eq('customer_id', customerData.id),
        supabase.from('transactions').select('*').eq('customer_id', customerData.id),
        supabase.from('cashback_transactions').select('*').eq('customer_id', customerData.id),
        supabase.from('credit_transactions').select('*').eq('customer_id', customerData.id),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        profile: customerData,
        appointments: appointments || [],
        consents: consentsRes.data || [],
        transactions: txRes.data || [],
        cashback: cashbackRes.data || [],
        credits: creditsRes.data || [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus-dados-${customerData.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Download iniciado.');
    } catch (e) {
      console.error(e);
      toast.error('Falha ao exportar seus dados.');
    }
  };

  const requestDeletion = async () => {
    if (!customerData?.id) return;
    if (!window.confirm('Confirmar solicitação de exclusão dos seus dados? A barbearia analisará o pedido.')) return;
    setRequesting(true);
    const { error } = await supabase
      .from('customers')
      .update({
        deletion_requested_at: new Date().toISOString(),
        deletion_status: 'pending',
      })
      .eq('id', customerData.id);
    setRequesting(false);
    if (error) {
      toast.error('Não foi possível registrar sua solicitação.');
    } else {
      toast.success('Solicitação enviada. Você será notificado quando for processada.');
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2"><ShieldCheck size={18} className="text-gold" /> Preferências de comunicação</CardTitle>
          <CardDescription className="text-gray-400">Controle como entramos em contato com você.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer rounded-lg bg-white/[0.03] border border-white/10 p-3">
            <input
              type="checkbox"
              checked={allowNotifications}
              onChange={(e) => setAllowNotifications(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-gold"
            />
            <span className="text-sm text-white/85">
              <span className="block font-semibold">Notificações operacionais</span>
              <span className="block text-white/55 text-xs mt-0.5">Confirmações, lembretes e comprovantes dos seus agendamentos.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-lg bg-white/[0.03] border border-white/10 p-3">
            <input
              type="checkbox"
              checked={allowMarketing}
              onChange={(e) => setAllowMarketing(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-gold"
            />
            <span className="text-sm text-white/85">
              <span className="block font-semibold">Promoções e campanhas</span>
              <span className="block text-white/55 text-xs mt-0.5">Receber ofertas, descontos e novidades pelos canais da barbearia.</span>
            </span>
          </label>
          <Button
            onClick={savePreferences}
            disabled={savingPrefs}
            className="w-full h-[42px] rounded-xl bg-gradient-to-r from-gold to-[#F5D061] text-black font-bold hover:shadow-[0_6px_18px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 transition-all duration-200"
          >
            {savingPrefs ? 'Salvando...' : 'Salvar preferências'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2"><Download size={18} className="text-gold" /> Meus dados</CardTitle>
          <CardDescription className="text-gray-400">Exporte uma cópia ou solicite exclusão (LGPD).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={exportData}
            variant="outline"
            className="w-full h-[42px] rounded-xl bg-black/40 border border-gold/40 text-white font-semibold hover:bg-gold/10 hover:text-white hover:border-gold/70 hover:-translate-y-0.5 transition-all duration-200"
          >
            <Download size={16} className="mr-2 text-gold" /> Baixar meus dados (JSON)
          </Button>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-xs text-white/70">
              A exclusão anonimiza seus dados pessoais (nome, telefone, e-mail).
              Registros financeiros exigidos por lei são mantidos. O processo é aprovado pela barbearia.
            </p>
            {deletionPending ? (
              <p className="mt-2 text-xs font-semibold text-amber-300">
                Solicitação em análise (enviada em {new Date(customerData.deletion_requested_at).toLocaleDateString('pt-BR')}).
              </p>
            ) : (
              <Button
                onClick={requestDeletion}
                disabled={requesting}
                variant="outline"
                className="w-full h-[42px] mt-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 font-semibold hover:bg-red-500/15 hover:text-red-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(239,68,68,0.25)] transition-all duration-200"
              >
                <Trash2 size={16} className="mr-2" /> {requesting ? 'Enviando...' : 'Solicitar exclusão dos meus dados'}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-white/40">
            Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

