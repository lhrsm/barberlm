import { createFileRoute, useNavigate, Outlet, useLocation, Link } from "@tanstack/react-router";
import { TrialExpiredBlock } from "@/components/subscription/TrialExpiredBlock";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Scissors, Calendar, CalendarDays, MapPin, Phone, MessageSquare, Clock, CheckCircle2, ChevronRight, ChevronLeft, ChevronDown, ShoppingBag, Package, Gift, Trash2, Star, QrCode, User as UserIcon, RefreshCcw, CircleDollarSign, ArrowLeft, ArrowRight, ArrowUp, Plus, Minus, Tag, TicketPercent, X, Crown, Menu, Lock as LockIcon, ExternalLink, Ban } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { createNotification } from "@/utils/notifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, addMinutes, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { triggerWhatsAppMessage } from "@/utils/whatsapp";
import { triggerAutomation } from "@/utils/automation";
import { normalizePhone } from "@/utils/phone";
import { usePublicModules } from "@/hooks/use-public-modules";
import { getSubscriptionUsage } from "@/hooks/use-subscription-usage";
import { ExhaustedUsesModal } from "@/components/portal/ExhaustedUsesModal";
import { ChangePlanModal } from "@/components/portal/ChangePlanModal";
import { SubscribePlanModal } from "@/components/portal/SubscribePlanModal";

import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';


export const Route = createFileRoute("/$slug")({
  component: ShopPageComponent,
  head: ({ params }) => {
    // We can't easily fetch shop data here in a sync head function without a loader, 
    // but the component itself updates the document.title.
    return {
      title: `Barbearia | ${params.slug}`,
      meta: [
        { name: "description", content: "Agende seu horário online de forma rápida e fácil." },
        { property: "og:title", content: "Barbearia Premium" },
        { property: "og:description", content: "Experiência premium de barbearia com agendamento online." },
      ],
    };
  },
});

function ShopPageComponent() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  const isEmbedded = searchParams.get('embed') === 'true';
  const initialPhone = searchParams.get('phone') || "";
  const initialName = searchParams.get('name') || "";
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [publicTestimonials, setPublicTestimonials] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [publicSubscriptionPlans, setPublicSubscriptionPlans] = useState<any[]>([]);
  const [publicLoyaltySettings, setPublicLoyaltySettings] = useState<any>(null);
  const [publicActiveCoupons, setPublicActiveCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(true);
  const [blockReason, setBlockReason] = useState("");
  const [subscribeModal, setSubscribeModal] = useState<{ open: boolean; plan: any | null }>({ open: false, plan: null });

  // Public modules — hide sections disabled by the barbershop owner in Settings > Modules
  const { isEnabled: isModuleEnabled } = usePublicModules(shop?.id);
  const productsEnabled = isModuleEnabled("products");
  const subscriptionsEnabled = isModuleEnabled("subscriptions");
  const cashbackEnabled = isModuleEnabled("cashback");
  const couponsEnabled = isModuleEnabled("coupons");
  const loyaltyEnabled = isModuleEnabled("loyalty");
  
  // Debug logs to trace route issues
  useEffect(() => {
    console.log('SHOP PAGE DEBUG:', { slug, path: location.pathname, loading, shopId: shop?.id });
  }, [slug, location.pathname, loading, shop?.id]);
  const [scrolled, setScrolled] = useState(false);
  
  const isPortalRoute = location.pathname.includes('/portal');
  const isProfissionalRoute = location.pathname.includes('/profissional');
  const isProfessionalsRoute = location.pathname.includes('/professionals');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Booking state
  const [bookingCart, setBookingCart] = useState<any[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [isServicesModalOpen, setIsServicesModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelTokenInput, setCancelTokenInput] = useState("");
  const [ratingAppointment, setRatingAppointment] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [modalBarber, setModalBarber] = useState<any>(null);
  const [isPixVisible, setIsPixVisible] = useState(false);
  const [selectedProductForModal, setSelectedProductProductForModal] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");

  const addToBookingCart = () => {
    if (!selectedService || !selectedBarber || !selectedDate || !selectedTime) {
      toast.error("Por favor, selecione serviço, barbeiro, data e horário.");
      return;
    }

    const newItem = {
      id: crypto.randomUUID(),
      service_id: selectedService.id,
      service_name: selectedService.name,
      barber_id: selectedBarber.id,
      barber_name: selectedBarber.name,
      date: selectedDate,
      start_time: selectedTime,
      duration: selectedService.duration_minutes || 30,
      price: selectedService.price || 0
    };

    setBookingCart(prev => [...prev, newItem]);
    
    // Reset selection for next service
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedTime("");
    setBookingStep(2); // Voltar para seleção de serviço
    toast.success("Serviço adicionado ao agendamento!");
  };

  const removeFromBookingCart = (id: string) => {
    setBookingCart(prev => prev.filter(item => item.id !== id));
  };

  const categories = useMemo(() => {
    const curated = ["Todos", "Pomadas", "Cabelos", "Barba", "Cuidados Pessoais", "Kits", "Acessórios"];
    const fromProducts = Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]));
    // Keep curated order, append any extra categories that exist in products but not in curated list
    const extras = fromProducts.filter(c => !curated.includes(c));
    return [...curated, ...extras];
  }, [products]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [allowMarketing, setAllowMarketing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [customerCashback, setCustomerCashback] = useState(0);
  const [customerCredits, setCustomerCredits] = useState(0);
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = useState(0);
  const [useCashback, setUseCashback] = useState(false);
  const [useCredits, setUseCredits] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [fetchingTimes, setFetchingTimes] = useState(false);
  const [dayAppointments, setDayAppointments] = useState<any[]>([]);
  const [loadingDayData, setLoadingDayData] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'barbershop' | 'credits' | null>(null);
  const [showPixStep, setShowPixStep] = useState(false);

  // Subscription state
  const [_activeSubscription, setActiveSubscription] = useState<any>(null);
  // Mask subscription when the module is disabled — keeps the booking flow as a regular client
  const activeSubscription = subscriptionsEnabled ? _activeSubscription : null;
  const [serviceEligibility, setServiceEligibility] = useState<Record<string, any>>({});
  const [subPlanServices, setSubPlanServices] = useState<any[]>([]);
  const [subUsageLogs, setSubUsageLogs] = useState<any[]>([]);
  const [benefitBalances, setBenefitBalances] = useState<any[]>([]);
  const subUsage = useMemo(
    () => getSubscriptionUsage(activeSubscription, subPlanServices, subUsageLogs),
    [activeSubscription, subPlanServices, subUsageLogs],
  );
  const [planBenefitServices, setPlanBenefitServices] = useState<any[]>([]); // {service_id, consume_quantity, benefit_key, benefit_name}
  const [bookingMode, setBookingMode] = useState<'benefit' | 'standalone' | null>(null);
  const [exhaustedOpen, setExhaustedOpen] = useState(false);
  const [exhaustedReason, setExhaustedReason] = useState<'empty' | 'combo'>('empty');
  const [exhaustedServiceName, setExhaustedServiceName] = useState<string | null>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [premiumSuccess, setPremiumSuccess] = useState<null | {
    plan: string;
    service: string;
    date: string;
    time: string;
    barber: string;
    remaining: number | null;
    nextRenewal: string | null;
  }>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);


  useEffect(() => {
    if (slug) {
      fetchShopData(slug);
      
      // Carregar sessão do portal se existir
      const savedClient = localStorage.getItem(`client_portal_session_${slug}`);
      if (savedClient) {
        try {
          const parsedClient = JSON.parse(savedClient);
          console.log('DEBUG: Auto-loading portal session on page mount', parsedClient);
          setCustomerPhone(parsedClient.phone); // PhoneInput handle formatting
          setCustomerName(parsedClient.name);
          setCustomerId(parsedClient.customer_id);
          // O customer_id será recuperado pelo checkCustomerCashback ou no handleFinalizeBooking
        } catch (e) {
          console.error('Error parsing saved client session:', e);
        }
      }

    }
  }, [slug]);

  // Listener para abrir a modal de agendamento a partir do portal (iframe ou componente interno)
  useEffect(() => {
    const handleOpenBooking = () => {
      console.log('DEBUG: Received OPEN_BOOKING_MODAL event');
      handleBookingAction();
    };

    window.addEventListener('OPEN_BOOKING_MODAL', handleOpenBooking);
    return () => window.removeEventListener('OPEN_BOOKING_MODAL', handleOpenBooking);
  }, [shop, customerPhone]);


  // Reativo: Busca automática de cliente pelo WhatsApp
  useEffect(() => {
    async function findCustomer() {
      if (!shop?.id || !customerPhone) return;
      
      const normalizedPhone = normalizePhone(customerPhone);
      
      console.log('BOOKING DATA DEBUG: phone changed', { customerPhone, normalizedPhone });
      
      // Busca internacional requer pelo menos 10 dígitos (DDD + Número)
      if (normalizedPhone.length < 10) {
        if (bookingStep === 1) {
          setCustomerId(null);
          // Only clear name if NOT in portal session
          if (!localStorage.getItem(`client_portal_session_${slug}`)) {
            setCustomerName("");
          }
        }
        return;
      }

      setIsSearchingCustomer(true);
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('phone', normalizedPhone)
          .eq('user_id', shop.id)
          .maybeSingle();

        console.log('BOOKING DATA DEBUG: customer query result', { data, error });

        if (data) {
          console.log('CUSTOMER FOUND:', data.name);
          setCustomerId(data.id);
          setCustomerName(data.name || "");
          setCustomerCashback(data.cashback_balance || 0);
          setCustomerLoyaltyPoints(data.loyalty_points || 0);
          setCustomerCredits(data.credits || 0);
          
          // Removed auto-advancing behavior - user must click Continue
          console.log('Customer identified, waiting for user to click Continue');
        } else {
          console.log('CUSTOMER NOT FOUND for phone:', normalizedPhone);
          setCustomerId(null);
          // Se não encontrou e não estamos em sessão do portal, garante que o nome está limpo
          if (!localStorage.getItem(`client_portal_session_${slug}`)) {
            // Only clear name if it matches an old ID or was automatically filled
            if (customerId) setCustomerName("");
          }
        }
      } catch (err) {
        console.error('Unexpected error finding customer:', err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }

    if (bookingStep === 1 && isBookingOpen) {
      const timer = setTimeout(() => {
        findCustomer();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [customerPhone, shop?.id, bookingStep, isBookingOpen, slug]);

  // Load active subscription whenever the identified customer changes
  useEffect(() => {
    async function loadActiveSub() {
      if (!customerId || !shop?.id) {
        setActiveSubscription(null);
        setServiceEligibility({});
        setSubPlanServices([]);
        setSubUsageLogs([]);
        setBookingMode(null);
        return;
      }
      const { data } = await supabase
        .from("customer_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("customer_id", customerId)
        .eq("tenant_id", shop.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveSubscription(data || null);
      setServiceEligibility({});
      if (data?.plan_id) {
        const [{ data: planSvcs }, { data: logs }] = await Promise.all([
          supabase
            .from("subscription_plan_services")
            .select("*, services(*)")
            .eq("plan_id", data.plan_id),
          supabase
            .from("subscription_usage_logs" as any)
            .select("*, services(name)")
            .eq("customer_id", customerId)
            .eq("subscription_id", data.id)
            .order("used_at", { ascending: false }),
        ]);
        setSubPlanServices(planSvcs || []);
        setSubUsageLogs((logs as any[]) || []);
      } else {
        setSubPlanServices([]);
        setSubUsageLogs([]);
      }
    }
    loadActiveSub();
  }, [customerId, shop?.id]);

  // Helper: check eligibility for a service (memoized in state)
  async function ensureEligibility(serviceId: string) {
    if (!customerId || !shop?.id || !serviceId) return null;
    if (serviceEligibility[serviceId]) return serviceEligibility[serviceId];
    const { data, error } = await (supabase as any).rpc("check_subscription_eligibility", {
      p_customer_id: customerId,
      p_service_id: serviceId,
      p_tenant_id: shop.id,
    });
    if (error) {
      console.error("eligibility error", error);
      return null;
    }
    setServiceEligibility((prev) => ({ ...prev, [serviceId]: data }));
    return data;
  }

  // Whenever the selected service or cart changes, pre-fetch eligibility
  useEffect(() => {
    const ids = new Set<string>();
    if (selectedService?.id) ids.add(selectedService.id);
    bookingCart.forEach((it: any) => it.service_id && ids.add(it.service_id));
    ids.forEach((id) => ensureEligibility(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService?.id, bookingCart, customerId, activeSubscription?.id]);



  useEffect(() => {
    if (isEmbedded && initialPhone) {
      setCustomerPhone(initialPhone);

      if (initialName) setCustomerName(initialName);
      
      // Auto trigger phone check if embedded with phone
      const timer = setTimeout(() => {
        const normalized = normalizePhone(initialPhone);
        console.log('DEBUG: Auto-checking phone normalized:', { original: initialPhone, normalized });
        handlePhoneCheckWithParams(normalized, initialName);
      }, 500);
      return () => clearTimeout(timer);
    } else if (isEmbedded) {
      setIsBookingOpen(true);
    }
  }, [isEmbedded, initialPhone, initialName, shop?.id]);

  const handlePhoneCheckWithParams = async (phone: string, name?: string) => {
    if (!phone || phone.length < 8 || !shop?.id) return;
    setSubmitting(true);
    try {
      console.log('AUTO-CHECKING CUSTOMER', { phone, name, shopId: shop.id });
      const customer = await checkCustomerCashback(phone);
      setCustomerPhone(phone);

      if (name) setCustomerName(name);
      else if (customer?.name) setCustomerName(customer.name);
      
      setIsBookingOpen(true);
      // Removed auto-advancing behavior - user must click Continue
      console.log('Auto-check complete, waiting for user to click Continue');
    } catch (error: any) {
      console.error("Error checking phone:", error);
      toast.error(error.message || "Erro ao verificar identificação");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (selectedDate && shop?.id && isBookingOpen) {
      fetchDayData(selectedDate);
    }
  }, [selectedDate, shop?.id, isBookingOpen]);

  // Font loading
  useEffect(() => {
    // Only attempt to load if it's not the default Inter
    if (typeof window !== 'undefined' && shop?.font_family && shop.font_family !== 'Inter') {
      const fontId = 'custom-shop-font';
      let link = document.getElementById(fontId) as HTMLLinkElement;
      
      if (!link) {
        link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      
      const fontName = shop.font_family.replace(/\s+/g, '+');
      link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;700&display=swap`;
    }
  }, [shop?.font_family]);

  useEffect(() => {
    if (bookingStep === 4 && selectedBarber && selectedDate) {
      setSelectedTime(""); // Reset time when barber or date changes
      fetchAvailableTimes(selectedBarber.id, selectedDate, selectedService);
    }
  }, [bookingStep, selectedBarber, selectedDate, selectedService]);

  const fetchAvailableTimes = async (barberId: string, date: string, service: any) => {
    console.log('BOOKING DATA DEBUG: fetchAvailableTimes', { 
      customerName, 
      customerPhone, 
      selectedService: service?.name, 
      barberId, 
      date 
    });

    if (!barberId || !service) {
      console.warn('DEBUG: No professional or service selected, skipping fetchAvailableTimes');
      return;
    }

    setFetchingTimes(true);
    try {
      const barber = barbers.find(b => b.id === barberId);
      if (!barber) {
        console.error("DEBUG: Barber not found in local state", { barberId, barbersCount: barbers.length });
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

      const times = [];
      const [startHour, startMin] = workingHours.start.split(':').map(Number);
      const [endHour, endMin] = workingHours.end.split(':').map(Number);
      
      const [y, m, d] = date.split('-').map(Number);

      console.log('WORKING HOURS', { start: workingHours.start, end: workingHours.end });
      console.log('EXISTING APPOINTMENTS', dayAppointments.filter(app => app.barber_id === barberId));

      for (let hour = startHour; hour <= endHour; hour++) {
        for (let min = (hour === startHour ? startMin : 0); min < 60; min += 30) {
          if (hour === endHour && min >= endMin) break;
          
          const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          const checkTime = new Date(y, m - 1, d, hour, min, 0);
          const now = new Date();
          const isToday = y === now.getFullYear() && (m - 1) === now.getMonth() && d === now.getDate();
          
          if (isToday && checkTime < now) continue;

          const checkTimeMs = checkTime.getTime();
          const serviceEndMs = checkTimeMs + (service.duration_minutes || 30) * 60 * 1000;

          // Check DB Appointments
          const isBusyApp = dayAppointments.some(app => {
            if (app.barber_id !== barberId) return false;
            const appStart = new Date(app.start_time).getTime();
            const appEnd = new Date(app.end_time).getTime();
            // Conflict rule: slotStart < appointmentEnd && slotEnd > appointmentStart
            return checkTimeMs < appEnd && serviceEndMs > appStart;
          });

          if (isBusyApp) continue;

          // Check Customer Conflict in Cart (Any barber)
          const isBusyCartCustomer = bookingCart.some(item => {
            const [itemHour, itemMin] = item.start_time.split(':').map(Number);
            const itemStart = new Date(y, m - 1, d, itemHour, itemMin, 0).getTime();
            const itemEnd = itemStart + (item.duration || 30) * 60 * 1000;
            return checkTimeMs < itemEnd && serviceEndMs > itemStart;
          });

          if (isBusyCartCustomer) continue;

          // Check Barber Conflict in Cart (Specific barber)
          const isBusyCartBarber = bookingCart.some(item => {
            if (item.barber_id !== barberId) return false;
            const [itemHour, itemMin] = item.start_time.split(':').map(Number);
            const itemStart = new Date(y, m - 1, d, itemHour, itemMin, 0).getTime();
            const itemEnd = itemStart + (item.duration || 30) * 60 * 1000;
            return checkTimeMs < itemEnd && serviceEndMs > itemStart;
          });

          if (isBusyCartBarber) continue;

          times.push(timeStr);
        }
      }
      
      console.log('AVAILABLE SLOTS', times);
      setAvailableTimes(times);
    } catch (error) {
      console.error("Error fetching times:", error);
    } finally {
      setFetchingTimes(false);
    }
  };

  const fetchDayData = async (date: string) => {
    if (!shop?.id) return;
    setLoadingDayData(true);
    try {
      const startOfDay = `${date}T00:00:00Z`;
      const endOfDay = `${date}T23:59:59Z`;
      
      const { data } = await supabase
        .from("appointments")
        .select("id, barber_id, start_time, end_time, status")
        .eq("user_id", shop.id)
        .in("status", ["scheduled", "confirmed", "in_progress", "awaiting_payment"])
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay);
        
      setDayAppointments(data || []);
    } catch (error) {
      console.error("Error fetching day data:", error);
    } finally {
      setLoadingDayData(false);
    }
  };

  const isBarberAvailableOnDate = (barber: any, date: string, service: any, appointments: any[], cartItems: any[] = []) => {
    if (!service || !barber) return false;
    
    const performsService = barber.barber_services?.some((bs: any) => bs.service_id === service.id);
    if (!performsService) {
      console.log(`BARBER ${barber.name} DOES NOT PERFORM SERVICE ${service.name}`);
      return false;
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
    const workingHours = barber.working_hours?.[dayKey];

    if (!workingHours || !workingHours.enabled) {
      console.warn('BARBER NOT WORKING ON THIS DAY', { dayKey, barber: barber.name });
      return false;
    }

    const barberAppointments = appointments?.filter(a => a.barber_id === barber.id) || [];
    const barberCartItems = cartItems.filter(item => item.barber_id === barber.id && item.date === date);
    
    console.log(`CHECKING AVAILABILITY for ${barber.name} on ${date}. Appointments: ${barberAppointments.length}, CartItems: ${barberCartItems.length}`);
    const [startHour, startMin] = workingHours.start.split(':').map(Number);
    const [endHour, endMin] = workingHours.end.split(':').map(Number);
    const interval = 30; // Min interval to check for a free slot

    for (let hour = startHour; hour <= endHour; hour++) {
      for (let min = (hour === startHour ? startMin : 0); min < 60; min += interval) {
        if (hour === endHour && min >= endMin) break;
        const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const [y, m, d] = date.split('-').map(Number);
        const checkTime = new Date(y, m - 1, d, hour, min, 0);
        
        if (isSameDay(checkTime, new Date()) && checkTime < new Date()) continue;

        const checkTimeMs = checkTime.getTime();
        const serviceEndMs = checkTimeMs + (service.duration_minutes || 30) * 60 * 1000;

        // Check Existing Appointments
        const isBusyApp = barberAppointments.some(app => {
          const appStart = new Date(app.start_time).getTime();
          const appEnd = new Date(app.end_time).getTime();
          const conflict = checkTimeMs < appEnd && serviceEndMs > appStart;
          return conflict;
        });

        if (isBusyApp) continue;

        // Check Items Already in Cart
        const isBusyCart = barberCartItems.some(item => {
          const [itemHour, itemMin] = item.start_time.split(':').map(Number);
          const itemStart = new Date(y, m - 1, d, itemHour, itemMin, 0).getTime();
          const itemEnd = itemStart + (item.duration || 30) * 60 * 1000;
          const conflict = checkTimeMs < itemEnd && serviceEndMs > itemStart;
          return conflict;
        });

        if (!isBusyCart) return true;
      }
    }
    return false;
  };

  async function fetchShopData(targetSlug: string) {
    console.log('DEBUG: Fetching shop data for slug:', targetSlug);
    if (!targetSlug) return;
    setLoading(true);
    try {
      // Normalização da slug
      const normalizedSlug = targetSlug.trim().toLowerCase();
      
      // Busca pública do perfil (apenas colunas necessárias)
      const { data: currentShop, error: profileError } = await supabase
        .from("profiles")
        .select(`
          id, 
          business_name, 
          slug, 
          whatsapp_number, 
          whatsapp_enabled, 
          primary_color, 
          secondary_color, 
          logo_url,
          barbershop_logo_url, 
          scheduling_mode, 
          cashback_enabled, 
          cashback_percentage, 
          address, 
          google_maps_url, 
          free_service_threshold, 
          font_family, 
          font_size, 
          font_color, 
          pix_key, 
          pix_qr_code_url, 
          status,
          trial_end,
          plan,
          effective_plan,
          selected_plan,
          opening_date,
          social_links
        `)
        .eq("slug", normalizedSlug)
        .maybeSingle();

      if (profileError || !currentShop) {
        console.error("Shop not found or error:", profileError);
        setLoading(false);
        return;
      }

      // Fetch subscription status for this shop
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("status, price_id")
        .eq("user_id", currentShop.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setShop(currentShop);

      // Access logic for public route
      const subscription_status = subData?.status || "";
      const plan_id = currentShop.plan || "";
      const effective_plan = currentShop.effective_plan || "";
      const trial_end = currentShop.trial_end;
      
      // LOGICA DEFINITIVA: Acesso se TRIAL VÁLIDO OU ASSINATURA ATIVA
      // O SaaS não possui plano free. Bloqueio somente se trial expirou E não há assinatura.
      const hasActiveSubscription = 
        ['active', 'paid', 'trialing', 'past_due'].includes(subscription_status.toLowerCase()) || 
        (plan_id && plan_id !== 'free' && plan_id !== '') ||
        (effective_plan && effective_plan !== 'free' && effective_plan !== '');
      
      const isTrialValid = trial_end ? new Date(trial_end) > new Date() : false;
      const canAccess = hasActiveSubscription || isTrialValid;
      const block_reason = !canAccess ? "Bloqueado: Trial expirado e sem assinatura ativa detectada" : "Liberado: Acesso concedido";

      // Temporary logs for debugging access as requested by user
      console.log("[profissional-access-debug]", {
        slug: normalizedSlug,
        tenant_id: currentShop.id,
        subscription_status,
        is_subscription_active: hasActiveSubscription,
        active_subscription: hasActiveSubscription,
        plan_id,
        trial_end,
        trial_valid: isTrialValid,
        has_active_subscription: hasActiveSubscription,
        can_access: canAccess,
        block_reason,
        source: "Supabase Public Profile + Subscriptions",
        now: new Date().toISOString()
      });

      console.log("[profissional-access-debug] Final Decision:", canAccess);

      setCanAccess(canAccess); 
      setBlockReason(block_reason);
      
      // Bypass any local cache for this specific logic
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`subscription_cache_${currentShop.id}`);
      }

      // Fetch services, barbers and products for this shop (all public now)
      const [servicesRes, barbersRes, productsRes] = await Promise.all([
        supabase
          .from("services")
          .select("*")
          .eq("user_id", currentShop.id)
          .eq("active", true),
        supabase
          .from("barbers")
          .select("*, barber_services(service_id)")
          .eq("user_id", currentShop.id)
          .eq("active", true),

        supabase
          .from("products")
          .select("*")
          .eq("user_id", currentShop.id)
          .eq("active", true),
      ]);

      setServices(servicesRes.data || []);

      // Enrich barbers with rating stats
      const barberList = barbersRes.data || [];
      let barbersWithStats: any[] = barberList;
      if (barberList.length > 0) {
        const { data: stats } = await supabase
          .from("barber_rating_stats" as any)
          .select("barber_id, avg_rating, total_ratings")
          .in("barber_id", barberList.map((b: any) => b.id));
        const statsMap = new Map((stats || []).map((s: any) => [s.barber_id, s]));
        barbersWithStats = barberList.map((b: any) => ({
          ...b,
          avg_rating: statsMap.get(b.id)?.avg_rating ?? null,
          total_ratings: statsMap.get(b.id)?.total_ratings ?? 0,
        }));
      }
      setBarbers(barbersWithStats);
      setProducts(productsRes.data || []);

      // Public approved testimonials
      try {
        const { data: testimonialsRes } = await supabase
          .from("appointment_reviews")
          .select("id, testimonial_text, barbershop_rating, barber_rating, created_at, customers(name, avatar_url), barbers(name)")
          .eq("tenant_id", currentShop.id)
          .eq("testimonial_status", "approved")
          .eq("show_on_frontend", true)
          .not("testimonial_text", "is", null)
          .order("approved_at", { ascending: false })
          .limit(9);
        setPublicTestimonials(testimonialsRes || []);
      } catch (_e) { /* silent */ }

      // Public extras: subscription plans, loyalty settings, active coupons
      // These are best-effort — failures (e.g. RLS) are silently ignored so the page still renders.
      try {
        const [plansRes, loyaltyRes, couponsRes] = await Promise.all([
          supabase
            .from("subscription_plans")
            .select("id, name, description, monthly_price, max_uses_per_month, benefits, included_benefits, active, display_order")
            .eq("tenant_id", currentShop.id)
            .eq("active", true)
            .order("display_order", { ascending: true }),
          supabase
            .from("loyalty_settings")
            .select("*")
            .eq("tenant_id", currentShop.id)
            .maybeSingle(),
          supabase
            .from("coupons")
            .select("id, code, type, value, expires_at, applies_to, active")
            .eq("tenant_id", currentShop.id)
            .eq("active", true)
            .limit(6),
        ]);
        setPublicSubscriptionPlans(plansRes.data || []);
        setPublicLoyaltySettings(loyaltyRes.data || null);
        setPublicActiveCoupons(couponsRes.data || []);
      } catch (e) {
        console.warn("Public extras fetch failed (non-blocking):", e);
      }

      // SEO dinâmico
      if (typeof document !== 'undefined') {
        document.title = `${currentShop.business_name} | Agende online`;
        const descContent = `Agende seu horário na ${currentShop.business_name} de forma rápida e fácil. Cortes premium, profissionais qualificados e atendimento de excelência.`;
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.setAttribute('name', 'description');
          document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', descContent);
        const setOg = (prop: string, content: string) => {
          let el = document.querySelector(`meta[property="${prop}"]`);
          if (!el) {
            el = document.createElement('meta');
            el.setAttribute('property', prop);
            document.head.appendChild(el);
          }
          el.setAttribute('content', content);
        };
        setOg('og:title', `${currentShop.business_name} | Agende online`);
        setOg('og:description', descContent);
        if (currentShop.barbershop_logo_url) setOg('og:image', currentShop.barbershop_logo_url);
      }
    } catch (error) {
      console.error("Error fetching shop data:", error);
    } finally {
      setLoading(false);
    }
  }

  const primaryColor = shop?.primary_color || "#7c3aed";

  const handleBookingAction = async () => {
    console.log('DEBUG: handleBookingAction triggered, isBookingOpen:', isBookingOpen);

    if (shop?.scheduling_mode === 'manual') {
      const message = encodeURIComponent(`Olá! Gostaria de agendar um horário na ${shop.business_name}.`);
      window.open(`https://wa.me/${shop.whatsapp_number}?text=${message}`, '_blank');
    } else {
      // Pre-fill with session data if exists
      const savedClient = localStorage.getItem(`client_portal_session_${slug}`);
      if (savedClient) {
        try {
          const parsedClient = JSON.parse(savedClient);
          console.log('DEBUG: Pre-filling booking from portal session', parsedClient);
          setCustomerPhone(parsedClient.phone);
          setCustomerName(parsedClient.name);
          setCustomerId(parsedClient.customer_id);

          // Fetch fresh data for credits/cashback
          if (parsedClient.customer_id) {
            const { data } = await supabase
              .from('customers')
              .select('*')
              .eq('id', parsedClient.customer_id)
              .maybeSingle();
            
            if (data) {
              console.log('DEBUG: Fresh customer data loaded for portal session', data);
              setCustomerCashback(data.cashback_balance || 0);
              setCustomerCredits(data.credits || 0);
              setCustomerLoyaltyPoints(data.loyalty_points || 0);
            }
          }
          
          // Se já temos o customerId, pulamos a identificação (Step 1)
          // Step 1: Boas-vindas/Telefone
          // Step 2: Seleção de Serviço
          console.log('DEBUG: Skipping to Step 2 as user is authenticated');
          setBookingStep(2);
        } catch (e) {
          console.error("Error loading session:", e);
          setBookingStep(1);
        }
      } else {
        setBookingStep(1);
      }
      setIsBookingOpen(true);
    }
  };



  // Fetch active subscription synchronously and update state. Returns the row or null.
  const fetchActiveSubscriptionFor = async (customerIdArg: string) => {
    if (!customerIdArg || !shop?.id) return null;
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("customer_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("customer_id", customerIdArg)
        .eq("tenant_id", shop.id)
        .eq("status", "active")
        .or(`current_period_end.gte.${nowIso},next_billing_at.gte.${nowIso}`)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("[PREMIUM FLOW] subscription lookup error", error);
        return null;
      }
      setActiveSubscription(data || null);
      setBookingMode(null);
      if (data?.plan_id) {
        const { data: planSvcs } = await supabase
          .from("subscription_plan_services")
          .select("*, services(*)")
          .eq("plan_id", data.plan_id);
        setSubPlanServices(planSvcs || []);

        // Load per-category benefit balances and benefit-service links (new system)
        const [{ data: balances }, { data: linksRaw }] = await Promise.all([
          (supabase as any).rpc("get_subscription_benefit_balance", { _subscription_id: data.id }),
          (supabase as any)
            .from("subscription_plan_benefit_services")
            .select("service_id, consume_quantity, benefit:subscription_plan_benefits(benefit_key, benefit_name)")
            .eq("plan_id", data.plan_id)
            .eq("active", true),
        ]);
        setBenefitBalances((balances as any[]) || []);
        const links = ((linksRaw as any[]) || []).map((r) => ({
          service_id: r.service_id,
          consume_quantity: r.consume_quantity,
          benefit_key: r.benefit?.benefit_key,
          benefit_name: r.benefit?.benefit_name,
        }));
        setPlanBenefitServices(links);
      } else {
        setSubPlanServices([]);
        setBenefitBalances([]);
        setPlanBenefitServices([]);
      }
      return data || null;
    } catch (e) {
      console.error("[PREMIUM FLOW] subscription lookup exception", e);
      return null;
    }
  };

  const handlePhoneCheck = async () => {
    const normalized = normalizePhone(customerPhone);
    console.log('BOOKING DATA DEBUG: handlePhoneCheck', { customerPhone, normalized, customerName, customerId });

    if (!customerPhone || normalized.length < 8) {
      toast.error("Por favor, informe um WhatsApp válido.");
      return;
    }
    
    setSubmitting(true);
    try {
      // If we don't have a customerId yet, try one last check
      let currentCustomer = null;
      if (!customerId) {
        const { data } = await supabase
          .from("customers")
          .select("id, name")
          .eq("phone", normalized)
          .eq("user_id", shop.id)
          .maybeSingle();
        currentCustomer = data;
      }

      const resolvedCustomerId = customerId || currentCustomer?.id || null;

      if (resolvedCustomerId) {
        const name = customerName || currentCustomer?.name;
        if (name) setCustomerName(name);
        if (currentCustomer?.id) setCustomerId(currentCustomer.id);

        // CRITICAL: check active subscription BEFORE advancing to step 2
        // so the premium chooser renders instead of the regular service list.
        const sub = await fetchActiveSubscriptionFor(resolvedCustomerId);
        const planUsed = sub?.uses_this_period || 0;
        const planMax = sub?.plan?.max_uses_per_month;
        const remaining = planMax ? Math.max(0, planMax - planUsed) : null;
        console.log('[PREMIUM FLOW] phone check result', {
          customer_id: resolvedCustomerId,
          phone: normalized,
          has_active_subscription: !!sub,
          subscription_id: sub?.id || null,
          plan_id: sub?.plan_id || null,
          plan_name: sub?.plan?.name || null,
          subscription_status: sub?.status || null,
          remaining_benefits: remaining,
          next_step: sub ? 'premium_chooser' : 'service_selection',
        });
        setBookingStep(2);
      } else {
        // Novo cliente
        if (!customerName || customerName.trim().length < 3) {
          toast.info("Por favor, informe seu nome completo.");
        } else {
          console.log('BOOKING DATA DEBUG: New customer proceeding', { customerName, customerPhone });
          setActiveSubscription(null);
          setBookingMode(null);
          setBookingStep(2);
        }
      }
    } catch (e: any) {
      toast.error("Erro ao verificar identificação: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };


  const handleSelectService = (service: any) => {
    console.log('DEBUG: handleSelectService triggered', service);
    setSelectedService(service);
    
    // Verificamos se já temos sessão salva para pular etapas
    const savedClient = localStorage.getItem(`client_portal_session_${slug}`);
    if (savedClient) {
      try {
        const parsedClient = JSON.parse(savedClient);
        setCustomerPhone(parsedClient.phone);
        setCustomerName(parsedClient.name);
        setBookingStep(3); // Pula para escolha de profissional
      } catch (e) {
        setBookingStep(1);
      }
    } else {
      setBookingStep(1);
    }
    setIsBookingOpen(true);
  };



  const checkConflict = async (barberId: string, date: string, time: string, serviceId: string) => {
    console.log('DEBUG: checkConflict (Barber)', { barberId, date, time, serviceId });
    const service = services.find(s => s.id === serviceId);
    if (!service) return false;
    
    const startTime = parseISO(`${date}T${time}:00`);
    const endTime = addMinutes(startTime, service.duration_minutes || 30);
    const startIso = startTime.toISOString();
    const endIso = endTime.toISOString();

    const { data, error } = await supabase
      .from("appointments")
      .select("id, start_time, end_time, status")
      .eq("barber_id", barberId)
      .in("status", ["scheduled", "confirmed", "in_progress"])
      .lt("start_time", endIso)
      .gt("end_time", startIso)
      .limit(1);

    if (error) {
      console.error("Erro ao verificar conflitos (barbeiro):", error);
      return false;
    }

    const hasConflict = data && data.length > 0;
    if (hasConflict) {
      console.log('CONFLITO DETECTADO (BARBEIRO):', data[0]);
    }
    return hasConflict;
  };



  const handleFinalizeBooking = async () => {
    const normalized = normalizePhone(customerPhone);
    console.log('DEBUG: Finalizing booking with normalized phone:', { original: customerPhone, normalized });

    if (!normalized || normalized.length < 10) {
      toast.error("Por favor, informe um WhatsApp válido com DDD.");
      setBookingStep(1);
      return;
    }

    if (!customerName || customerName.trim().length < 3) {
      toast.error("Por favor, informe seu nome completo.");
      setBookingStep(1);
      return;
    }

    if (bookingCart.length === 0 && !selectedService) {
      toast.error("Seu agendamento está vazio.");
      setBookingStep(2);
      return;
    }

    // Combine any currently selected service into the cart if it's ready
    let finalCart = [...bookingCart];
    if (selectedService && selectedBarber && selectedDate && selectedTime) {
      finalCart.push({
        id: crypto.randomUUID(),
        service_id: selectedService.id,
        service_name: selectedService.name,
        barber_id: selectedBarber.id,
        barber_name: selectedBarber.name,
        date: selectedDate,
        start_time: selectedTime,
        duration: selectedService.duration_minutes || 30,
        price: selectedService.price || 0
      });
    }

    setSubmitting(true);
    try {
      // 1. Ensure customer exists
      let finalCustId = customerId;
      console.log('TABLE:', 'customers');
      console.log('ACTION:', finalCustId ? 'select/update' : 'select/insert');
      
      if (!finalCustId) {
        console.log('DEBUG: Checking for existing customer by phone', { phone: normalized });
        const { data: existingCust, error: checkError } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", normalized)
          .eq("user_id", shop.id)
          .maybeSingle();
        
        if (checkError) {
          console.error('SUPABASE ERROR (check customer):', checkError);
          throw checkError;
        }

        if (existingCust) {
          finalCustId = existingCust.id;
          console.log('DEBUG: Found existing customer', finalCustId);
          // Update name if it was missing or different
          await supabase.from("customers").update({ name: customerName }).eq("id", finalCustId);
        } else {
          console.log('DEBUG: Creating new customer', { name: customerName, phone: normalized });
          const customerPayload = {
            user_id: shop.id,
            name: customerName,
            phone: normalized
          };
          console.log('PAYLOAD:', customerPayload);
          
          const { data: newCust, error: custError } = await supabase
            .from("customers")
            .insert([customerPayload])
            .select()
            .single();
          
          if (custError) {
            console.error('SUPABASE ERROR (insert customer):', custError);
            throw custError;
          }
          finalCustId = newCust.id;
          setCustomerId(finalCustId);
          console.log('DEBUG: New customer created', finalCustId);
        }
      } else {
        // Sync name if changed
        console.log('DEBUG: Updating existing customer name', { id: finalCustId, name: customerName });
        const { error: updateError } = await supabase.from("customers").update({ name: customerName }).eq("id", finalCustId);
        if (updateError) console.error('SUPABASE ERROR (update customer name):', updateError);
      }

      const isMultipleAppt = finalCart.length > 1;
      let appointmentGroupId = null;
      let groupTokenValLocal: string | null = null;

      if (isMultipleAppt) {
        groupTokenValLocal = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const { data: groupData, error: groupError } = await supabase.from("appointment_groups").insert([{
          tenant_id: shop.id,
          customer_id: finalCustId,
          group_token: groupTokenValLocal,
          total_amount: calculateTotal(),
          payment_status: (paymentMethod === 'pix' || calculateTotal() === 0) ? 'paid' : 'pending',
          status: 'active'
        }]).select().single();

        if (groupError) throw groupError;
        appointmentGroupId = groupData.id;
        console.log('DEBUG: Appointment group created', { id: appointmentGroupId, token: groupTokenValLocal });
      }

      const finalPaymentMethod = paymentMethod || (calculateTotal() === 0 ? (useCredits ? 'credits' : 'cashback') : 'barbershop');

      // 2. Create Appointments
      console.log('TABLE:', 'appointments');
      console.log('ACTION:', 'insert');
      console.log('APPOINTMENT GROUP ID:', appointmentGroupId);
      
      const appointmentPromises = finalCart.map((item, index) => {
        const timeWithSeconds = item.start_time.length === 5 ? `${item.start_time}:00` : item.start_time;
        const startTime = parseISO(`${item.date}T${timeWithSeconds}`);
        const endTime = addMinutes(startTime, item.duration);

        // === Subscription coverage check ===
        const elig = serviceEligibility[item.service_id];
        const isCoveredFull =
          elig?.has_active_subscription &&
          elig?.service_included &&
          !elig?.requires_payment &&
          elig?.reason === "full_coverage";
        const isCoveredPartial =
          elig?.has_active_subscription &&
          elig?.service_included &&
          elig?.requires_payment &&
          elig?.reason === "partial_coverage";
        const subCoveredAmount = isCoveredFull
          ? Number(item.price)
          : isCoveredPartial
            ? Number(elig?.covered_amount || 0)
            : 0;
        const subExtraAmount = isCoveredPartial
          ? Math.max(0, Number(item.price) - subCoveredAmount)
          : 0;

        const totalValue = calculateSubtotal();
        const totalDiscount = calculateDiscount();
        const payableValue = totalValue - totalDiscount;

        // Distribute cashback and credits proportionally if multiple appointments
        const ratio = totalValue > 0 ? item.price / totalValue : 0;
        let apptCashbackUsed = useCashback ? Number((Math.min(customerCashback, payableValue) * ratio).toFixed(2)) : 0;
        let apptCreditsUsed = useCredits ? Number((Math.min(customerCredits, payableValue - apptCashbackUsed) * ratio).toFixed(2)) : 0;
        let apptFinalAmount = Math.max(0, item.price - apptCashbackUsed - apptCreditsUsed);

        // When fully covered by subscription, zero out any payment
        if (isCoveredFull) {
          apptCashbackUsed = 0;
          apptCreditsUsed = 0;
          apptFinalAmount = 0;
        }

        const appointmentPayload: any = {
          user_id: shop.id,
          tenant_id: shop.id,
          customer_id: finalCustId,
          service_id: item.service_id,
          barber_id: item.barber_id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          total_price: item.price,
          original_total: item.price,
          status: "confirmed",
          payment_status: isCoveredFull
            ? 'covered_by_subscription'
            : (calculateTotal() === 0 ? 'paid' : 'pending'),
          payment_method: isCoveredFull
            ? 'subscription'
            : isCoveredPartial
              ? 'subscription_plus_payment'
              : (apptCashbackUsed > 0 || apptCreditsUsed > 0) ? 'mixed' : finalPaymentMethod,
          cashback_used: apptCashbackUsed,
          credits_used: apptCreditsUsed,
          pix_amount: !isCoveredFull && finalPaymentMethod === 'pix' ? apptFinalAmount : 0,
          cash_amount: !isCoveredFull && finalPaymentMethod === 'barbershop' ? apptFinalAmount : 0,
          final_amount: apptFinalAmount,
          source: 'online',
          appointment_group_id: appointmentGroupId,
          service_amount: item.price,
          group_sequence: index + 1,
          subscription_id: (isCoveredFull || isCoveredPartial) ? (elig?.subscription_id || activeSubscription?.id || null) : null,
          subscription_plan_id: (isCoveredFull || isCoveredPartial) ? (elig?.plan_id || activeSubscription?.plan_id || null) : null,
          subscription_covered_amount: subCoveredAmount,
          extra_amount: subExtraAmount,
          items: [{
            id: item.service_id,
            name: item.service_name,
            type: 'service',
            price: item.price,
            quantity: 1
          }]
        };

        return supabase.from("appointments").insert([appointmentPayload]).select().single();
      });



      const appointmentResults = await Promise.all(appointmentPromises);
      const createdAppointments = appointmentResults.map(res => {
        if (res.error) {
          console.error('SUPABASE ERROR (insert appointment):', res.error);
          throw res.error;
        }
        return res.data;
      });

      // LGPD: register consent + update customer preferences (best-effort, non-blocking)
      try {
        const finalCustId = createdAppointments[0]?.customer_id || null;
        await supabase.from('privacy_consents').insert([{
          tenant_id: shop?.id || null,
          customer_id: finalCustId,
          accepted_terms: true,
          accepted_privacy: true,
          allow_marketing: allowMarketing,
          allow_notifications: true,
          source: 'public_booking',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
        }]);
        if (finalCustId) {
          await supabase.from('customers').update({
            allow_marketing: allowMarketing,
            allow_notifications: true,
            privacy_accepted_at: new Date().toISOString(),
            terms_accepted_at: new Date().toISOString(),
          }).eq('id', finalCustId);
        }
      } catch (consentErr) {
        console.warn('LGPD consent insert failed (non-blocking):', consentErr);
      }


      // 2.5 Create Finance Transactions for Paid Appointments (e.g. Full Credits/Cashback)
      for (const appt of createdAppointments) {
        if (appt.payment_status === 'paid' && (appt.payment_method === 'credits' || appt.payment_method === 'cashback')) {
          const item = finalCart.find(i => i.service_id === appt.service_id);
          const amount = appt.total_price || 0;
          
          if (amount > 0) {
            console.log('DEBUG: Creating transaction for paid (credits/cashback) appointment', appt.id);
            await supabase.from("transactions").insert([{
              amount: amount,
              type: "income",
              description: `Agendamento Online (${appt.payment_method?.toUpperCase()}): ${item?.service_name || 'Serviço'} - ${customerName}`,
              category: "Serviço",
              barber_id: appt.barber_id,
              appointment_id: appt.id,
              tenant_id: shop.id,
              user_id: shop.id,
              date: new Date().toISOString().split('T')[0]
            }]);
          }
        }
      }

      // 2.6 Consume subscription benefit for covered appointments
      for (const appt of createdAppointments) {
        if (appt.subscription_id && (appt.payment_method === 'subscription' || appt.payment_method === 'subscription_plus_payment')) {
          // Prefer new per-category engine; fall back to legacy RPC if no benefit links configured.
          const hasNewLinks = planBenefitServices.some((l: any) => l.service_id === appt.service_id);
          if (hasNewLinks) {
            const { data: res, error: rpcErr } = await (supabase as any).rpc('consume_subscription_benefits_v2', {
              _subscription_id: appt.subscription_id,
              _service_id: appt.service_id,
              _appointment_id: appt.id,
            });
            if (rpcErr || (res && res.success === false)) {
              console.error('[PREMIUM FLOW] consume_subscription_benefits_v2 error', rpcErr || res);
            }
          } else {
            await (supabase as any).rpc('consume_subscription_benefit', {
              p_appointment_id: appt.id,
              p_subscription_id: appt.subscription_id,
              p_service_id: appt.service_id,
              p_covered_amount: appt.subscription_covered_amount || 0,
              p_extra_amount: appt.extra_amount || 0,
            });
          }
        }
      }




      // 3. Handle Product Sales if any
      if (selectedProducts.length > 0) {
        const totalProducts = selectedProducts.reduce((acc, p) => acc + (p.price * (p.quantity || 1)), 0);
        await supabase.from("product_sales").insert([{
          user_id: shop.id,
          customer_id: finalCustId,
          total_amount: totalProducts,
          status: 'completed',
          items: selectedProducts.map(p => ({
            product_id: p.id,
            name: p.name,
            price: p.price,
            quantity: p.quantity || 1
          }))
        }]);

        // Update stock
        for (const item of selectedProducts) {
          await (supabase as any).rpc('decrement_product_stock', { 
            prod_id: item.id, 
            amount: item.quantity || 1 
          });
        }
      }

      // 4. Update Customer Wallet (Deductions)
      const totalDiscount = calculateDiscount();
      const totalValue = calculateSubtotal();
      const cashbackToDeduct = useCashback ? Math.min(customerCashback, totalValue - totalDiscount) : 0;
      const creditsToDeduct = useCredits ? Math.min(customerCredits, totalValue - totalDiscount - cashbackToDeduct) : 0;

      if (cashbackToDeduct > 0 || creditsToDeduct > 0) {
        await supabase
          .from("customers")
          .update({ 
            cashback_balance: customerCashback - cashbackToDeduct,
            credits: customerCredits - creditsToDeduct
          })
          .eq("id", finalCustId);
      }

      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customerAppointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });

      // 5. Notifications
      for (const appt of createdAppointments) {
        const item = finalCart.find(i => i.service_id === appt.service_id);
        const barberName = item?.barber_name || "Barbeiro";
        const serviceName = item?.service_name || "Serviço";
        
        await createNotification({
          userId: shop.id,
          type: 'appointment_created',
          title: "Novo Agendamento",
          message: `${customerName} agendou ${serviceName} com ${barberName} às ${item?.start_time}`,
          barberId: appt.barber_id || undefined,
          customerId: finalCustId || undefined,
          metadata: { appointmentId: appt.id }
        });
      }

      // 5. Trigger Automation System (New V2)
      if (createdAppointments.length > 0) {
        console.log("DEBUG: Triggering automation for new appointments", createdAppointments.map(a => a.id));
        
        if (isMultipleAppt && appointmentGroupId) {
          // Para múltiplos agendamentos, disparamos apenas UM gatilho usando o primeiro agendamento
          // mas o sistema de automação saberá que ele pertence a um grupo
          triggerAutomation({
            tenant_id: shop.id,
            event_name: 'appointment.created',
            appointment_id: createdAppointments[0].id
          }).catch(err => console.error("Error triggering automation:", err));
        } else {
          // Agendamento único
          for (const appt of createdAppointments) {
            triggerAutomation({
              tenant_id: shop.id,
              event_name: 'appointment.created',
              appointment_id: appt.id
            }).catch(err => console.error("Error triggering automation:", err));
          }
        }
      }


      toast.success("Agendamentos realizados com sucesso!");
      
      // 6. Ensure session persistence before redirecting
      const sessionData = {
        phone: normalized,
        customer_id: finalCustId,
        name: customerName
      };
      
      localStorage.setItem(`client_portal_session_${slug}`, JSON.stringify(sessionData));
      console.log('DEBUG: Persisted session before portal redirect', sessionData);

      // Premium success screen — when client used the subscription benefit
      const usedBenefit = createdAppointments.some(
        (a: any) => a.subscription_id && (a.payment_method === 'subscription' || a.payment_method === 'subscription_plus_payment')
      );
      if (usedBenefit && activeSubscription && createdAppointments.length === 1) {
        const appt = createdAppointments[0] as any;
        const item = finalCart.find((i) => i.service_id === appt.service_id) || finalCart[0];

        // Refetch usage logs so the reserved log created by the DB trigger is included.
        const { data: freshLogs } = await supabase
          .from("subscription_usage_logs" as any)
          .select("*, services(name)")
          .eq("customer_id", finalCustId)
          .eq("subscription_id", activeSubscription.id);
        setSubUsageLogs((freshLogs as any[]) || []);
        const freshUsage = getSubscriptionUsage(activeSubscription, subPlanServices, (freshLogs as any[]) || []);
        const max = freshUsage.total_uses_allowed || (activeSubscription.plan?.max_uses_per_month ?? null);
        const remaining = max ? freshUsage.total_uses_available : null;

        setPremiumSuccess({
          plan: activeSubscription.plan?.name || "Assinatura",
          service: item?.service_name || "Serviço",
          date: item?.date || format(new Date(), "yyyy-MM-dd"),
          time: item?.start_time || "",
          barber: item?.barber_name || "",
          remaining,
          nextRenewal: activeSubscription.next_billing_at || activeSubscription.current_period_end || null,
        });
        // Soft-reset booking flow but keep modal-free overlay visible
        setBookingCart([]);
        setSelectedProducts([]);
        setIsBookingOpen(false);
        setBookingStep(1);
        setBookingMode(null);
        setAppliedCoupon(null);
        setUseCashback(false);
        setUseCredits(false);
        setPaymentMethod(null);
        return;
      }

      // Reset and redirect
      setIsBookingOpen(false);
      setBookingCart([]);
      setSelectedProducts([]);
      setBookingStep(1);
      setBookingMode(null);
      setAppliedCoupon(null);
      setUseCashback(false);
      setUseCredits(false);
      setPaymentMethod(null);
      
      const isMultipleFinal = createdAppointments.length > 1;
      const groupTokenFinal = (createdAppointments[0] as any)?.group_token || groupTokenValLocal;

      setTimeout(() => {
        // Redirecionamento usando navigate do TanStack Router com substituição de histórico
        if (isMultipleFinal && groupTokenFinal) {
          navigate({ to: `/agendamentos/grupo/${groupTokenFinal}` as any, search: { tenant: shop.id } as any, replace: true });
        } else if (createdAppointments.length === 1) {
          const appt = createdAppointments[0] as any;
          // Redirecionar para o portal se houver sessão, caso contrário para a página de gestão via token
          const portalSession = localStorage.getItem(`client_portal_session_${slug}`);
          if (portalSession) {
            navigate({ to: `/${slug}/portal` as any, replace: true });
          } else {
            navigate({ to: `/agendamento/${appt.management_token || appt.id}` as any, search: { tenant: shop.id } as any, replace: true });
          }
        } else {
          navigate({ to: `/${slug}/portal` as any, replace: true });
        }
      }, 1500);

    } catch (error: any) {
      toast.error("Erro ao realizar agendamento: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancelTokenInput) {
      toast.error("Por favor, insira o código de cancelamento.");
      return;
    }

    setCancelling(true);
    try {
      const { data, error } = await (supabase as any).rpc('cancel_appointment_by_token', { 
        token_val: cancelTokenInput 
      });

      if (error) throw error;

      if (data) {
        toast.success("Agendamento cancelado com sucesso.");
        setIsCancelModalOpen(false);
        setCancelTokenInput("");
      } else {
        toast.error("Código inválido ou agendamento já cancelado.");
      }
    } catch (error: any) {
      toast.error("Erro ao cancelar: " + error.message);
    } finally {
      setCancelling(false);
    }
  };
  const handleSubmitRating = async () => {
    if (!ratingAppointment) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("service_ratings")
        .insert({
          appointment_id: ratingAppointment.id,
          customer_id: ratingAppointment.customer_id,
          barber_id: ratingAppointment.barber_id,
          user_id: shop.id,
          rating: ratingValue,
          comment: ratingComment
        });

      if (error) {
        if (error.code === '23505') {
          toast.error("Você já avaliou este atendimento.");
        } else {
          throw error;
        }
      } else {
        toast.success("Obrigado pela sua avaliação!");
        setIsRatingModalOpen(false);
        setRatingAppointment(null);
        setRatingComment("");
        setRatingValue(5);
      }
    } catch (error: any) {
      toast.error("Erro ao enviar avaliação: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckRatingEligibility = async () => {
    if (!cancelTokenInput) {
      toast.error("Por favor, insira o código do seu agendamento.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, service_ratings(id)")
        .eq("cancel_token", cancelTokenInput)
        .single();

      if (error || !data) {
        toast.error("Agendamento não encontrado.");
        return;
      }

      if (data.status !== 'completed') {
        toast.error("Você só pode avaliar atendimentos concluídos.");
        return;
      }

      if (data.service_ratings && (Array.isArray(data.service_ratings) ? data.service_ratings.length > 0 : !!data.service_ratings)) {
        toast.error("Este atendimento já foi avaliado.");
        return;
      }

      setRatingAppointment(data);
      setIsRatingModalOpen(true);
      setIsCancelModalOpen(false);
    } catch (error: any) {
      toast.error("Erro ao buscar agendamento.");
    } finally {
      setLoading(false);
    }
  };

  const calculateSubtotal = () => {
    const servicesTotal = bookingCart.reduce((acc, item) => acc + (item.price || 0), 0);
    const currentServicePrice = selectedService?.price || 0;
    const productsTotal = selectedProducts.reduce((acc, p) => acc + ((p.price || 0) * (p.quantity || 1)), 0);
    return servicesTotal + currentServicePrice + productsTotal;
  };

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    const subtotal = calculateSubtotal();
    let discount = 0;
    
    if (appliedCoupon.type === 'fixed') {
      discount = appliedCoupon.value;
    } else {
      discount = subtotal * (appliedCoupon.value / 100);
    }
    
    if (appliedCoupon.max_discount) {
      discount = Math.min(discount, appliedCoupon.max_discount);
    }
    
    return discount;
  };

  const calculateTotalBeforeCredits = () => {
    return Math.max(0, calculateSubtotal() - calculateDiscount());
  };

  const calculateTotalBeforeCashback = () => {
    let total = calculateTotalBeforeCredits();
    if (useCredits) {
      total = Math.max(0, total - Math.min(customerCredits, total));
    }
    return total;
  };

  const calculateSubscriptionCoverage = () => {
    const items = [
      ...bookingCart.map(i => ({ service_id: i.service_id, price: i.price || 0 })),
      ...(selectedService ? [{ service_id: selectedService.id, price: selectedService.price || 0 }] : []),
    ];
    let covered = 0;
    for (const it of items) {
      const elig = serviceEligibility[it.service_id];
      if (!elig?.has_active_subscription || !elig?.service_included) continue;
      if (!elig?.requires_payment) {
        covered += it.price;
      } else if (elig?.reason === 'partial_coverage') {
        covered += Math.min(it.price, Number(elig?.covered_amount || 0));
      }
    }
    return covered;
  };

  const calculateTotal = () => {
    let total = calculateTotalBeforeCashback();
    if (useCashback) {
      total = Math.max(0, total - Math.min(customerCashback, total));
    }
    total = Math.max(0, total - calculateSubscriptionCoverage());
    return total;
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !shop?.id) return;
    
    setIsApplyingCoupon(true);
    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('tenant_id', shop.id)
        .eq('code', couponCode.toUpperCase().trim())
        .eq('active', true)
        .maybeSingle();

      if (error) throw error;

      if (!coupon) {
        toast.error("Cupom inválido ou inexistente.");
        return;
      }

      // Subscription-only coupons can NOT be used on product/service orders
      if ((coupon as any).applies_to === 'subscription') {
        toast.error("Este cupom é exclusivo para assinaturas e não pode ser usado em agendamentos avulsos.");
        return;
      }


      // Validations
      const now = new Date();
      
      // Special validation for FESTEJE10
      if (coupon.code === 'FESTEJE10' && shop?.opening_date) {
        const openingDate = new Date(shop.opening_date);
        // Comparar dia e mês
        if (now.getDate() !== openingDate.getUTCDate() || now.getMonth() !== openingDate.getUTCMonth()) {
           toast.error("Este cupom só pode ser utilizado no dia do aniversário da barbearia.");
           return;
        }
      }

      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        toast.error("Este cupom já expirou.");
        return;
      }

      if (coupon.usage_limit && (coupon.used_count || 0) >= coupon.usage_limit) {
        toast.error("Este cupom atingiu o limite de usos.");
        return;
      }

      const subtotal = calculateSubtotal();
      if (coupon.minimum_amount && subtotal < coupon.minimum_amount) {
        toast.error(`Pedido mínimo de R$ ${coupon.minimum_amount.toFixed(2)} não atingido.`);
        return;
      }

      setAppliedCoupon(coupon);
      setCouponCode("");
      toast.success("Cupom aplicado com sucesso!");
    } catch (error: any) {
      console.error("Error applying coupon:", error);
      toast.error("Erro ao aplicar cupom.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };


  const addToCart = (product: any) => {
    const existing = selectedProducts.find(p => p.id === product.id);
    if (existing) {
      setSelectedProducts(selectedProducts.map(p => 
        p.id === product.id ? { ...p, quantity: (p.quantity || 1) + 1 } : p
      ));
    } else {
      setSelectedProducts([...selectedProducts, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} adicionado ao carrinho`);
  };

  const removeFromCart = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setSelectedProducts(selectedProducts.map(p => {
      if (p.id === productId) {
        const newQty = Math.max(1, (p.quantity || 1) + delta);
        return { ...p, quantity: newQty };
      }
      return p;
    }));
  };

  const toggleProduct = (product: any) => {
    const existing = selectedProducts.find(p => p.id === product.id);
    if (existing) {
      removeFromCart(product.id);
    } else {
      addToCart(product);
    }
  };

  const checkCustomerCashback = async (phone: string) => {
    const normalized = normalizePhone(phone);
    console.log('DEBUG: checkCustomerCashback', { phone, normalized });
    
    if (normalized.length >= 10) {
      setSubmitting(true);
      try {
        const { data, error } = await supabase
          .from("customers")
          .select("id, cashback_balance, loyalty_points, name, credits")
          .eq("phone", normalized)
          .eq("user_id", shop.id)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching customer:', error);
          return null;
        }

        if (data) {
          console.log('CUSTOMER RESULT FOUND', data);
          setCustomerCashback(data.cashback_balance || 0);
          setCustomerLoyaltyPoints(data.loyalty_points || 0);
          setCustomerCredits(data.credits || 0);
          if (data.name) setCustomerName(data.name);
          setCustomerId(data.id);
          return data;
        } else {
          console.log('CUSTOMER RESULT NOT FOUND');
          // Se não encontrou cliente, limpa o ID e possivelmente o nome se não for sessão do portal
          setCustomerId(null);
          if (!localStorage.getItem(`client_portal_session_${slug}`)) {
            setCustomerName("");
          }
          setCustomerCashback(0);
          setCustomerLoyaltyPoints(0);
          return null;
        }
      } finally {
        setSubmitting(false);
      }
    }
    return null;
  };


  // Remoção do avanço automático para garantir que o cliente veja a identificação no card
  // conforme solicitado pela nova UX do BarberLM.

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


  return (
    <div 
      className="min-h-screen bg-black text-white selection:bg-[#D4AF37]/30 overflow-x-hidden" 
      style={{ 
        backgroundColor: "black",
        fontFamily: shop?.font_family ? `'${shop.font_family}', sans-serif` : 'Inter, sans-serif',
        fontSize: shop?.font_size || '16px',
      }}
    >
      <style>{`
        .phone-input-container .react-international-phone-input {
          color: black !important;
        }
        .react-international-phone-country-selector-dropdown {
          z-index: 9999 !important;
          background-color: white !important;
          color: black !important;
          border-radius: 1rem !important;
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1) !important;
          margin-top: 8px !important;
        }
        .react-international-phone-country-selector-list-item {
          padding: 10px 15px !important;
          font-weight: 600 !important;
        }
        .react-international-phone-country-selector-list-item:hover {
          background-color: #f3f4f6 !important;
        }
      `}</style>

      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-12 w-12 border-t-2 border-r-2 border-[#D4AF37] rounded-full"
              style={{ borderTopColor: "#D4AF37", borderRightColor: "#D4AF37" }}
            />
          </motion.div>
        )}
      </AnimatePresence>


      {!canAccess && !isProfissionalRoute && <TrialExpiredBlock />}

      {/* Main Content */}
      {(!isPortalRoute && !isProfissionalRoute && !isProfessionalsRoute) ? (
        <>
          {/* Header */}
          {!isEmbedded && (
            <header
              className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
                "backdrop-blur-xl border-b",
                scrolled
                  ? "bg-[rgba(5,11,24,0.94)] border-[rgba(212,175,55,0.22)] shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
                  : "bg-[rgba(5,11,24,0.78)] border-[rgba(212,175,55,0.18)] shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
              )}
            >
              <motion.div
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={cn(
                  "mx-auto max-w-7xl flex items-center justify-between gap-4 px-4 sm:px-6 transition-all duration-500",
                  scrolled ? "h-[76px]" : "h-[92px]"
                )}
              >
                {/* Logo destacada */}
                <a href="#inicio" className="flex items-center shrink-0 group" aria-label={shop.business_name}>
                  <div
                    className={cn(
                      "relative rounded-full bg-[#0B1324] border-2 border-[#D4AF37]/60 overflow-hidden transition-all duration-500",
                      "shadow-[0_0_24px_rgba(212,175,55,0.25)] group-hover:shadow-[0_0_32px_rgba(212,175,55,0.45)] group-hover:border-[#D4AF37]",
                      scrolled ? "h-[60px] w-[60px] md:h-16 md:w-16" : "h-[60px] w-[60px] md:h-[72px] md:w-[72px]"
                    )}
                  >
                    {shop.barbershop_logo_url ? (
                      <img
                        src={shop.barbershop_logo_url}
                        alt={shop.business_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full grid place-items-center">
                        <Scissors className={cn("text-[#D4AF37] transition-all", scrolled ? "h-6 w-6" : "h-7 w-7")} />
                      </div>
                    )}
                  </div>
                </a>

                {/* Nav desktop centralizado */}
                <nav className="hidden md:flex items-center gap-7 text-[11px] font-black uppercase tracking-[0.18em] text-white/70 absolute left-1/2 -translate-x-1/2">
                  {[
                    { href: "#inicio", label: "Início" },
                    { href: "#servicos", label: "Serviços" },
                    { href: "#profissionais", label: "Profissionais" },
                    ...(subscriptionsEnabled && publicSubscriptionPlans.length > 0 ? [{ href: "#clube", label: "Planos" }] : []),
                    ...(productsEnabled ? [{ href: "#produtos", label: "Produtos" }] : []),
                    ...(loyaltyEnabled && publicLoyaltySettings?.enabled ? [{ href: "#fidelidade", label: "Fidelidade" }] : []),
                    { href: "#contato", label: "Contato" },
                  ].map((it) => (
                    <a
                      key={it.href}
                      href={it.href}
                      className="relative py-1 transition-colors hover:text-[#D4AF37] after:absolute after:left-1/2 after:-bottom-1 after:h-px after:w-0 after:-translate-x-1/2 after:bg-[#D4AF37] after:transition-all hover:after:w-full"
                    >
                      {it.label}
                    </a>
                  ))}
                  {(cashbackEnabled || couponsEnabled) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="relative py-1 inline-flex items-center gap-1 transition-colors hover:text-[#D4AF37] outline-none">
                        Mais <ChevronDown className="h-3 w-3" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-[#05070d] border-[#D4AF37]/20 text-white min-w-[180px]">
                        {cashbackEnabled && shop?.cashback_enabled && (
                          <DropdownMenuItem asChild>
                            <a href="#cashback" className="cursor-pointer text-xs font-bold uppercase tracking-[0.15em]">Cashback</a>
                          </DropdownMenuItem>
                        )}
                        {couponsEnabled && publicActiveCoupons.length > 0 && (
                          <DropdownMenuItem asChild>
                            <a href="#campanhas" className="cursor-pointer text-xs font-bold uppercase tracking-[0.15em]">Campanhas</a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <a href={`/${shop.slug}/portal`} className="cursor-pointer text-xs font-bold uppercase tracking-[0.15em]">Portal do Cliente</a>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </nav>

                {/* Ações direita */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={handleBookingAction}
                    className={cn(
                      "rounded-full font-extrabold tracking-wide text-black transition-all",
                      "bg-gradient-to-br from-[#F5C542] to-[#D4A017] hover:from-[#F8D265] hover:to-[#D4A017]",
                      "shadow-[0_10px_28px_rgba(245,197,66,0.28)] hover:-translate-y-0.5",
                      "h-[42px] px-[18px] text-xs md:h-12 md:px-7 md:text-sm"
                    )}
                  >
                    {shop.scheduling_mode === 'manual' ? 'WhatsApp' : 'Agendar Agora'}
                  </Button>

                  {/* Hambúrguer mobile */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-11 w-11 rounded-full bg-[#0B1324] border border-[#D4AF37]/30 text-white hover:bg-[#0B1324] hover:border-[#D4AF37]/70 hover:text-[#D4AF37]"
                        aria-label="Abrir menu"
                      >
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="bg-[#05070d] border-l border-[#D4AF37]/15 text-white w-[280px] p-0">
                      <div className="flex items-center gap-3 p-6 border-b border-white/10">
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-[#0B1324] border-2 border-[#D4AF37]/60 shadow-[0_0_18px_rgba(212,175,55,0.3)]">
                          {shop.barbershop_logo_url ? (
                            <img src={shop.barbershop_logo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full grid place-items-center"><Scissors className="h-5 w-5 text-[#D4AF37]" /></div>
                          )}
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Menu</span>
                      </div>
                      <nav className="flex flex-col p-2">
                        {[
                          { href: "#inicio", label: "Início" },
                          { href: "#servicos", label: "Serviços" },
                          { href: "#profissionais", label: "Profissionais" },
                          ...(subscriptionsEnabled && publicSubscriptionPlans.length > 0 ? [{ href: "#clube", label: "Planos" }] : []),
                          ...(productsEnabled ? [{ href: "#produtos", label: "Produtos" }] : []),
                          ...(loyaltyEnabled && publicLoyaltySettings?.enabled ? [{ href: "#fidelidade", label: "Fidelidade" }] : []),
                          ...(cashbackEnabled && shop?.cashback_enabled ? [{ href: "#cashback", label: "Cashback" }] : []),
                          ...(couponsEnabled && publicActiveCoupons.length > 0 ? [{ href: "#campanhas", label: "Campanhas" }] : []),
                          { href: "#contato", label: "Contato" },
                          { href: `/${shop.slug}/portal`, label: "Portal do Cliente" },
                        ].map((it) => (
                          <a
                            key={it.href}
                            href={it.href}
                            className="px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-[0.15em] text-white/80 hover:bg-white/5 hover:text-[#D4AF37] transition-colors"
                          >
                            {it.label}
                          </a>
                        ))}
                        <Button
                          onClick={handleBookingAction}
                          className="mt-4 mx-2 rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-black font-extrabold h-12 shadow-[0_10px_28px_rgba(245,197,66,0.25)]"
                        >
                          Agendar Agora
                        </Button>
                      </nav>
                    </SheetContent>
                  </Sheet>
                </div>
              </motion.div>
            </header>
          )}




      <main className={cn("space-y-0", isEmbedded && "py-0 pb-0")}>
        {/* Hero Section */}
        <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-[calc(92px+env(safe-area-inset-top)+24px)] pb-12 md:pt-0 md:pb-0 md:h-screen md:min-h-[700px]">
          {/* Background Image with Parallax effect could be added here */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black z-10" />
          <div className="absolute inset-0 z-0">
             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074')] bg-cover bg-center scale-105 animate-pulse duration-[10s]" />
          </div>

          <div className="relative z-20 max-w-5xl mx-auto px-4 text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-5 flex flex-col items-center"
            >
              {shop?.barbershop_logo_url && (
                <img
                  src={shop.barbershop_logo_url}
                  alt={shop.business_name}
                  className="h-20 w-20 md:h-24 md:w-24 rounded-2xl object-contain bg-black/40 backdrop-blur-md border border-[#D4AF37]/30 p-2 shadow-2xl"
                />
              )}
              <span className="text-[#D4AF37] font-black uppercase tracking-[0.3em] text-xs md:text-sm">
                Bem-vindo à
              </span>
              <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter uppercase italic leading-none">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40" style={{ WebkitTextStroke: `1px #D4AF37` }}>
                  {shop?.business_name || 'Barbearia Premium'}
                </span>
              </h2>
              <p className="text-base md:text-xl text-slate-300 max-w-2xl mx-auto font-medium px-4">
                Agende seu horário com praticidade, escolha seu barbeiro favorito e acompanhe tudo pelo seu portal.
              </p>
              {shop?.address && (
                <p className="text-xs md:text-sm text-slate-400 font-medium flex items-center gap-2">
                  <MapPin size={14} className="text-[#D4AF37]" /> {shop.address}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center justify-center gap-3 w-full max-w-5xl mx-auto"
            >
              {/* Primário */}
              <button
                onClick={handleBookingAction}
                className="group inline-flex items-center justify-center gap-2 h-14 px-5 whitespace-nowrap rounded-full font-extrabold text-[14px] text-[#050505] bg-gradient-to-br from-[#F5C542] to-[#D4A017] shadow-[0_12px_30px_rgba(245,197,66,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(245,197,66,0.42)] w-full sm:w-auto sm:flex-1 sm:min-w-[180px]"
              >
                <Calendar size={16} /> Agendar Agora
              </button>

              {/* Secundário — Ver Serviços */}
              <button
                onClick={() => document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center justify-center gap-2 h-14 px-5 whitespace-nowrap rounded-full font-extrabold text-[14px] text-white bg-white/[0.04] border border-[#F5C542]/35 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F5C542] hover:bg-white/[0.07] hover:shadow-[0_10px_28px_rgba(245,197,66,0.22)] w-full sm:w-auto sm:flex-1 sm:min-w-[180px]"
              >
                <Scissors size={16} /> Ver Serviços
              </button>

              {subscriptionsEnabled && publicSubscriptionPlans.length > 0 && (
                <button
                  onClick={() => document.getElementById('clube')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center gap-2 h-14 px-5 whitespace-nowrap rounded-full font-extrabold text-[14px] text-white bg-white/[0.04] border border-[#F5C542]/35 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F5C542] hover:bg-white/[0.07] hover:shadow-[0_10px_28px_rgba(245,197,66,0.22)] w-full sm:w-auto sm:flex-1 sm:min-w-[180px]"
                >
                  <Crown size={16} /> Conhecer Planos
                </button>
              )}

              {productsEnabled && products.length > 0 && (
                <button
                  onClick={() => document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center gap-2 h-14 px-5 whitespace-nowrap rounded-full font-extrabold text-[14px] text-white bg-white/[0.04] border border-[#F5C542]/35 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F5C542] hover:bg-white/[0.07] hover:shadow-[0_10px_28px_rgba(245,197,66,0.22)] w-full sm:w-auto sm:flex-1 sm:min-w-[180px]"
                >
                  <ShoppingBag size={16} /> Ver Produtos
                </button>
              )}
            </motion.div>
          </div>

          {/* Scroll Indicator */}
          <motion.div 
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 opacity-50"
          >
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center p-1">
              <div className="w-1 h-2 bg-white rounded-full" />
            </div>
          </motion.div>
        </section>

        {/* Services Section */}
        <section id="servicos" className="py-24 bg-black relative">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
              <div className="space-y-4">
                <span className="text-[#D4AF37] font-black uppercase tracking-[0.2em] text-sm">Experiência Premium</span>
                <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">Nossos Serviços</h3>
              </div>
              <p className="text-slate-400 max-w-md text-lg">
                Combinamos técnicas tradicionais com tendências modernas para garantir o seu melhor visual.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service, idx) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  viewport={{ once: true }}
                >
                  <Card
                    className="group relative overflow-hidden rounded-[2rem] h-full border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black hover:border-[#D4AF37]/50 hover:-translate-y-1 transition-all duration-500 shadow-2xl hover:shadow-[#D4AF37]/10 cursor-pointer"
                    onClick={() => handleSelectService(service)}
                  >
                    <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#D4AF37]/10 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative p-7 flex flex-col h-full gap-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-[-6deg] transition-all duration-500">
                          <Scissors className="h-6 w-6 text-[#D4AF37]" />
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-1">A partir de</p>
                          <p className="text-3xl font-black tracking-tighter text-white">
                            <span className="text-sm text-white/50 font-bold mr-1">R$</span>{service.price.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 flex-1">
                        <h4 className="text-2xl font-black uppercase tracking-tight text-white group-hover:text-[#D4AF37] transition-colors duration-500">
                          {service.name}
                        </h4>
                        <p className="text-white/50 text-sm line-clamp-2 leading-relaxed">
                          {service.description || "Cuidado especializado com produtos de alta qualidade para um resultado impecável."}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <div className="flex items-center gap-2 text-white/60">
                          <Clock className="h-4 w-4 text-[#D4AF37]" />
                          <span className="text-xs font-bold uppercase tracking-widest">{service.duration_minutes} min</span>
                        </div>
                        <Button
                          size="sm"
                          className="h-10 px-5 rounded-full font-bold text-xs uppercase tracking-wider bg-[#D4AF37] text-black hover:bg-white transition-all group-hover:scale-105 shadow-lg"
                          onClick={(e) => { e.stopPropagation(); handleSelectService(service); }}
                        >
                          Agendar <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Products Section */}
        {productsEnabled && (
        <section id="produtos" className="py-24 bg-[#050505] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center space-y-4 mb-20">
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="text-[#D4AF37] font-black uppercase tracking-[0.3em] text-xs" 

              >
                Marketplace Elite
              </motion.span>
              <motion.h3 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter"
              >
                Produtos Premium
              </motion.h3>
              <motion.p 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                className="text-slate-500 max-w-xl mx-auto font-medium"
              >
                Os melhores produtos para manter seu estilo impecável e cuidado pessoal em dia.
              </motion.p>
            </div>
            <div className="-mx-4 px-4 mb-12 overflow-x-auto custom-scrollbar lg:overflow-visible">
              <div className="flex lg:flex-wrap items-center justify-start lg:justify-center gap-2 min-w-max lg:min-w-0">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        "shrink-0 h-10 px-5 rounded-full font-black uppercase tracking-widest text-[11px] transition-all duration-200 border",
                        isActive
                          ? "bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-[#050505] border-transparent shadow-[0_8px_20px_rgba(245,197,66,0.28)]"
                          : "bg-white/[0.03] border-white/10 text-slate-400 hover:border-[#F5C542]/50 hover:text-white"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop Grid / Mobile Scroll */}
            <div className="flex overflow-x-auto pb-8 gap-6 snap-x scroll-smooth lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 custom-scrollbar">
              {products
                .filter(p => p.active && (activeCategory === "Todos" || p.category === activeCategory))
                .map((product, idx) => (
                <motion.div
                  key={product.id}
                  className="flex-shrink-0 w-[300px] snap-center lg:w-auto"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="group bg-zinc-950 border-zinc-800 rounded-[20px] md:rounded-[2rem] overflow-hidden hover:border-primary/50 hover:-translate-y-2 transition-all duration-500 flex flex-col h-full shadow-2xl hover:shadow-primary/10">
                    <div className="relative overflow-hidden bg-zinc-900 h-[200px] sm:h-[220px] md:aspect-square md:h-auto">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-20 text-zinc-700">
                          <Package size={80} />
                        </div>
                      )}
                      
                      {product.badge && (
                        <div className="absolute top-5 left-5 z-10">
                          <span className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-2xl" style={{ backgroundColor: primaryColor }}>
                            {product.badge}
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                         <Button 
                          className="rounded-full h-12 w-12 bg-white text-black hover:bg-white/90 shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-500"
                          onClick={() => setSelectedProductProductForModal(product)}
                        >
                          <ShoppingBag size={20} />
                        </Button>
                         <Button 
                          variant="secondary"
                          className="rounded-full h-12 w-12 bg-zinc-800/80 backdrop-blur-md text-white hover:bg-zinc-700 shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-500 border border-white/10"
                          onClick={() => {
                            const message = encodeURIComponent(`Olá! Tenho interesse no produto ${product.name} na ${shop.business_name}.`);
                            window.open(`https://wa.me/${shop.whatsapp_number}?text=${message}`, '_blank');
                          }}
                        >
                          <MessageSquare size={20} />
                        </Button>
                      </div>
                    </div>

                    <div 
                      className="p-[18px] md:p-7 flex flex-col flex-1 space-y-3 md:space-y-4 cursor-pointer"
                      onClick={() => setSelectedProductProductForModal(product)}
                    >
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{product.category || 'Cuidados'}</p>
                        <h4 className="text-base md:text-xl font-black uppercase tracking-tight leading-tight text-white group-hover:text-primary transition-colors" style={{ '--primary': primaryColor } as any}>{product.name}</h4>
                        {product.brand && <p className="text-xs font-bold text-zinc-400">{product.brand}</p>}
                      </div>

                      <p className="text-zinc-400 text-xs md:text-sm line-clamp-2 leading-relaxed flex-1 font-medium">
                        {product.short_description || product.description || "Produto selecionado com rigor para garantir resultados superiores."}
                      </p>

                      <div className="pt-3 md:pt-4 border-t border-white/5 space-y-3 md:space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-lg md:text-2xl font-black text-white" style={{ color: primaryColor }}>R$ {Number(product.price).toFixed(2)}</span>
                            {product.promotional_price && (
                              <span className="text-xs text-slate-500 line-through font-bold">R$ {Number(product.promotional_price).toFixed(2)}</span>
                            )}
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Disponível</p>
                             <p className="text-xs font-bold text-slate-400">{product.stock_quantity} unidades</p>
                          </div>
                        </div>

                        <div className="pt-2 space-y-2">
                          <Button
                            variant="outline"
                            className="w-full h-11 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-transparent border border-[#F5C542]/35 text-[#F5C542] hover:bg-[#F5C542]/10 hover:border-[#F5C542] transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProductProductForModal(product);
                            }}
                          >
                            Ver Produto
                          </Button>
                          <Button 
                            className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-[#050505] shadow-[0_8px_20px_rgba(245,197,66,0.25)] hover:shadow-[0_12px_28px_rgba(245,197,66,0.35)] hover:-translate-y-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProduct(product);
                            }}
                          >
                            {selectedProducts.find(p => p.id === product.id) ? 'Remover do Carrinho' : 'Adicionar ao Carrinho'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Ver Todos os Produtos */}
            <div className="mt-12 flex justify-center">
              <button
                onClick={() => {
                  setActiveCategory("Todos");
                  document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center justify-center gap-2 h-14 px-10 rounded-full font-black uppercase tracking-widest text-[12px] text-white bg-[#0a0a0a] border border-[#F5C542]/40 hover:border-[#F5C542] hover:bg-[#F5C542]/[0.08] hover:text-[#F5C542] hover:shadow-[0_12px_30px_rgba(245,197,66,0.25)] transition-all duration-200"
              >
                <ShoppingBag size={16} /> Ver Todos os Produtos
              </button>
            </div>
          </div>
        </section>
        )}

        {/* Barbers Section */}
        <section id="profissionais" className="py-24 bg-black">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center space-y-4 mb-20">
              <span className="text-[#D4AF37] font-black uppercase tracking-[0.2em] text-sm">Elite Team</span>
              <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">Especialistas</h3>
            </div>

            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {barbers.map((barber, idx) => (
                <motion.div
                  key={barber.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  viewport={{ once: true }}
                  className="group"
                  onClick={() => {
                    setModalBarber(barber);
                    setIsServicesModalOpen(true);
                  }}
                >
                  <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden mb-6 shadow-2xl">
                    {barber.avatar_url ? (
                      <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-[#1a1a1a]">
                        <UserIcon className="h-20 w-20 text-white/10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                    
                    <div className="absolute bottom-8 left-8 right-8 space-y-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-[#D4AF37] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                          {idx === 0 ? "Top Avaliado" : "Especialista"}
                        </span>
                      </div>
                      <h4 className="text-3xl font-black uppercase italic tracking-tighter text-white">{barber.name}</h4>
                      <div className="flex items-center gap-1.5">
                        <Star size={14} className="text-yellow-500" fill="currentColor" />
                        <span className="text-sm font-bold text-white">{barber.avg_rating ? Number(barber.avg_rating).toFixed(1) : "—"}</span>
                        <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest ml-1">({barber.total_ratings || 0} avaliações)</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        {publicTestimonials.length > 0 && (
          <section id="depoimentos" className="py-24 bg-[#080808]">
            <div className="max-w-6xl mx-auto px-4">
              <div className="text-center space-y-4 mb-16">
                <span className="text-[#D4AF37] font-black uppercase tracking-[0.2em] text-sm">O que dizem</span>
                <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">Depoimentos</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {publicTestimonials.map((t) => (
                  <div key={t.id} className="rounded-2xl p-6 border border-[#D4AF37]/30 bg-gradient-to-br from-zinc-950 to-black shadow-[0_2px_12px_-4px_rgba(212,175,55,0.15)] hover:border-[#D4AF37]/60 hover:shadow-[0_12px_40px_-8px_rgba(212,175,55,0.45)] hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center gap-1 mb-3">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={14} className={cn(n <= (t.barbershop_rating || 5) ? "text-[#D4AF37] fill-[#D4AF37]" : "text-gray-700")} />
                      ))}
                    </div>
                    <p className="text-white/90 italic mb-4 text-sm leading-relaxed">"{t.testimonial_text}"</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{t.customers?.name || "Cliente"}</span>
                      {t.barbers?.name && <span className="text-[#D4AF37]/70">com {t.barbers.name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Clube Premium / Assinaturas */}
        {subscriptionsEnabled && publicSubscriptionPlans.length > 0 && (
          <section id="clube" className="py-24 bg-[#050505] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-transparent pointer-events-none" />
            <div className="max-w-6xl mx-auto px-4 relative">
              <div className="text-center space-y-4 mb-16">
                <div className="inline-flex items-center gap-2 text-[#D4AF37] font-black uppercase tracking-[0.3em] text-xs">
                  <Crown size={14} /> Exclusivo para Membros
                </div>
                <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">Clube Premium</h3>
                <p className="text-slate-400 max-w-xl mx-auto text-lg">
                  Assine um plano mensal e tenha benefícios exclusivos todos os meses na {shop.business_name}.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {publicSubscriptionPlans.slice(0, 6).map((plan, idx) => {
                  const benefits = Array.isArray(plan.benefits) ? plan.benefits : (Array.isArray(plan.included_benefits) ? plan.included_benefits : []);
                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      viewport={{ once: true }}
                      className="group relative rounded-[2rem] p-8 border border-[#D4AF37]/20 bg-gradient-to-br from-zinc-950 to-black hover:border-[#D4AF37]/60 transition-all flex flex-col"
                    >
                      <div className="space-y-2 mb-6">
                        <h4 className="text-2xl font-black uppercase tracking-tight text-white">{plan.name}</h4>
                        {plan.description && (
                          <p className="text-sm text-slate-400 line-clamp-2">{plan.description}</p>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1 mb-6">
                        <span className="font-black text-white leading-none" style={{ fontSize: 'clamp(34px, 9vw, 56px)' }}>
                          <span className="font-black text-white/90 mr-1" style={{ fontSize: 'clamp(20px, 5.5vw, 32px)' }}>R$</span>
                          {Number(plan.monthly_price || 0).toFixed(2)}
                        </span>
                        <span className="text-sm md:text-base text-slate-500 font-bold" style={{ fontSize: 'clamp(14px, 3vw, 18px)' }}>/mês</span>
                      </div>
                      {plan.max_uses_per_month != null && (
                        <p className="text-xs uppercase tracking-widest font-bold text-[#D4AF37] mb-4">
                          Até {plan.max_uses_per_month} usos/mês
                        </p>
                      )}
                      {benefits.length > 0 && (
                        <ul className="space-y-2 mb-8 flex-1">
                          {benefits.slice(0, 5).map((b: any, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <CheckCircle2 size={16} className="text-[#D4AF37] shrink-0 mt-0.5" />
                              <span>{typeof b === 'string' ? b : (b.name || b.description || JSON.stringify(b))}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        className="w-full h-12 rounded-xl bg-[#D4AF37] text-black font-black uppercase tracking-tighter hover:bg-[#D4AF37]/90"
                        onClick={handleBookingAction}
                      >
                        Assinar agora
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Promoções — banners sem expor códigos */}
        {couponsEnabled && publicActiveCoupons.length > 0 && (
          <section id="promocoes" className="py-20 bg-black">
            <div className="max-w-6xl mx-auto px-4">
              <div className="text-center space-y-3 mb-12">
                <span className="text-[#D4AF37] font-black uppercase tracking-[0.3em] text-xs">Campanhas</span>
                <h3 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Ofertas Especiais Disponíveis</h3>
                <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
                  Aproveite condições exclusivas. Use o seu cupom no momento do agendamento.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {publicActiveCoupons.slice(0, 3).map((c, idx) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    viewport={{ once: true }}
                    className="group relative rounded-3xl border border-[#F5C542]/20 bg-gradient-to-br from-[#0B1324] via-black to-black p-7 flex flex-col gap-5 transition-all duration-300 hover:border-[#F5C542]/60 hover:shadow-[0_20px_50px_rgba(245,197,66,0.18)] hover:-translate-y-1 overflow-hidden"
                  >
                    <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#F5C542]/10 blur-3xl pointer-events-none" />
                    <div className="relative flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#F5C542]/25 to-[#D4A017]/10 flex items-center justify-center border border-[#F5C542]/30">
                        <TicketPercent size={18} className="text-[#F5C542]" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F5C542]">Oferta Especial</span>
                    </div>
                    <div className="relative space-y-2">
                      <h4 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white leading-tight">
                        Condição exclusiva disponível
                      </h4>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        Já tem o cupom? Aplique no momento do agendamento e garanta o seu benefício.
                      </p>
                    </div>
                    {c.expires_at && (
                      <p className="relative text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                        <Calendar size={12} className="text-[#F5C542]/70" />
                        Válido até {format(parseISO(c.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                    <Button
                      className="relative mt-auto h-12 rounded-2xl bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-[#050505] font-black uppercase tracking-widest text-[11px] shadow-[0_8px_20px_rgba(245,197,66,0.28)] hover:shadow-[0_12px_28px_rgba(245,197,66,0.4)] hover:-translate-y-0.5 transition-all"
                      onClick={handleBookingAction}
                    >
                      <Calendar size={14} className="mr-2" /> Agendar agora
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}


        {/* Programa de Fidelidade */}
        {loyaltyEnabled && publicLoyaltySettings?.enabled && (
          <section id="fidelidade" className="py-24 bg-[#050505]">
            <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <span className="text-[#D4AF37] font-black uppercase tracking-[0.3em] text-xs">Recompensas</span>
                <h3 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Programa de Fidelidade</h3>
                <p className="text-slate-400 text-lg leading-relaxed">
                  A cada atendimento concluído você acumula pontos para ganhar recompensas exclusivas.
                </p>
                {publicLoyaltySettings?.appointments_required && (
                  <div className="rounded-2xl border border-[#D4AF37]/20 bg-black/60 p-6">
                    <p className="text-sm text-slate-300">
                      Complete <span className="text-[#D4AF37] font-black">{publicLoyaltySettings.appointments_required}</span> atendimentos
                      {publicLoyaltySettings.benefit_description ? (
                        <> e ganhe <span className="text-white font-bold">{publicLoyaltySettings.benefit_description}</span>.</>
                      ) : (' e ganhe um serviço especial.')}
                    </p>
                  </div>
                )}
                <Button
                  className="h-12 px-8 rounded-full bg-[#D4AF37] text-black font-black uppercase tracking-tighter hover:bg-[#D4AF37]/90"
                  onClick={handleBookingAction}
                >
                  Começar a acumular
                </Button>
              </div>
              <div className="relative rounded-[28px] overflow-hidden border border-[#D4AF37]/30 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] min-h-[240px] md:min-h-[360px]">
                <img
                  src="https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=1600&auto=format&fit=crop"
                  alt="Cliente sendo atendido em barbearia premium"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/20" />
                <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D4AF37] text-black text-[10px] font-black uppercase tracking-[0.18em] shadow-lg">
                  <span className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
                  Programa Ativo
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 space-y-2">
                  <h4 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-white leading-tight">
                    Ganhe recompensas a cada visita
                  </h4>
                  <p className="text-sm text-white/80 max-w-md">
                    Volte mais vezes, acumule benefícios e aproveite experiências exclusivas.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Cashback */}
        {cashbackEnabled && shop?.cashback_enabled && (
          <section id="cashback" className="py-20 bg-black">
            <div className="max-w-4xl mx-auto px-4">
              <div className="rounded-[3rem] p-12 md:p-16 bg-gradient-to-br from-emerald-950/40 via-black to-black border border-emerald-500/20 text-center space-y-6">
                <div className="inline-flex items-center gap-2 text-emerald-400 font-black uppercase tracking-[0.3em] text-xs">
                  <CircleDollarSign size={14} /> Dinheiro de volta
                </div>
                <h3 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Ganhe Cashback</h3>
                <p className="text-slate-300 text-lg max-w-xl mx-auto">
                  Receba <span className="text-emerald-400 font-black">{Number(shop.cashback_percentage || 0)}%</span> do valor de volta para usar em próximos atendimentos na {shop.business_name}.
                </p>
                <Button
                  className="h-12 px-8 rounded-full bg-emerald-500 text-black font-black uppercase tracking-tighter hover:bg-emerald-400"
                  onClick={handleBookingAction}
                >
                  Agendar e ganhar
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Como Funciona */}
        <section id="como-funciona" className="py-24 bg-[#050505]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center space-y-3 mb-16">
              <span className="text-[#D4AF37] font-black uppercase tracking-[0.3em] text-xs">Simples e rápido</span>
              <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">Como funciona</h3>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              {[
                { n: '01', t: 'Escolha o serviço', d: 'Selecione o serviço desejado em nosso catálogo.' },
                { n: '02', t: 'Escolha o profissional', d: 'Encontre o barbeiro perfeito para você.' },
                { n: '03', t: 'Selecione o horário', d: 'Veja a agenda em tempo real e escolha o melhor horário.' },
                { n: '04', t: 'Confirme', d: 'Confirme seu agendamento em segundos.' },
                { n: '05', t: 'Acompanhe', d: 'Gerencie tudo pelo portal do cliente.' },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl border border-white/5 bg-black p-6 space-y-3 hover:border-[#D4AF37]/40 transition-all">
                  <p className="text-[#D4AF37] font-black text-3xl tracking-tighter">{s.n}</p>
                  <h4 className="text-lg font-black uppercase tracking-tight text-white">{s.t}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
            {subscriptionsEnabled && publicSubscriptionPlans.length > 0 && (
              <p className="text-center text-slate-500 text-sm mt-10 max-w-2xl mx-auto">
                Se você for assinante do Clube Premium, o sistema identifica seus benefícios automaticamente.
              </p>
            )}
          </div>
        </section>

        {/* Portal CTA Section — Premium with image */}
        <section className="py-20 md:py-24 bg-[#0a0a0a] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[120px] rounded-full pointer-events-none" style={{ backgroundColor: `${primaryColor}05` }} />

          <div className="max-w-6xl mx-auto px-4 relative z-10">
            <div
              className="grid md:grid-cols-2 overflow-hidden rounded-[28px] md:rounded-[32px] border border-[#F5C542]/20 bg-[rgba(5,11,24,0.92)] shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
            >
              {/* Image — top on mobile, right on desktop */}
              <div className="relative h-[220px] sm:h-[280px] md:h-auto md:min-h-[420px] md:order-2">
                <img
                  src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1600&auto=format&fit=crop"
                  alt="Barbearia premium — cliente sendo atendido"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(5,11,24,0.95)] via-[rgba(5,11,24,0.35)] to-transparent md:bg-gradient-to-r md:from-[rgba(5,11,24,0.95)] md:via-[rgba(5,11,24,0.25)] md:to-transparent" />
                <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5C542] text-black text-[10px] font-black uppercase tracking-[0.18em] shadow-lg">
                  <span className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
                  Agenda aberta
                </div>
              </div>

              {/* Content */}
              <div className="p-8 sm:p-10 md:p-14 flex flex-col justify-center space-y-6 md:order-1">
                <span className="text-[#D4AF37] font-black uppercase tracking-[0.3em] text-xs">Sua vez</span>
                <h3 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-[1.02]">
                  Pronto para elevar seu visual?
                </h3>
                <p className="text-slate-300/90 text-base md:text-lg leading-relaxed max-w-xl">
                  Agende seu horário agora e experimente o padrão de excelência que você merece.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
                  <Button
                    className="h-[52px] px-7 rounded-full font-black uppercase tracking-widest text-[12px] text-[#050505] bg-gradient-to-br from-[#F5C542] to-[#D4A017] shadow-[0_12px_30px_rgba(245,197,66,0.32)] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(245,197,66,0.45)] transition-all"
                    onClick={handleBookingAction}
                  >
                    Agendar meu horário
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-[52px] px-7 rounded-full font-black uppercase tracking-widest text-[12px] bg-[#0B1324] border border-[#F5C542]/40 text-white hover:bg-[#F5C542]/[0.08] hover:border-[#F5C542] hover:text-[#F5C542] transition-all"
                  >
                    <a href={`/${slug}/portal`}>Acessar meu portal</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Footer */}
        {(() => {
          const social = (shop as any)?.social_links || {};
          const socials = [
            { key: "instagram", url: social.instagram, label: "Instagram", path: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM17.5 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" },
            { key: "facebook", url: social.facebook, label: "Facebook", path: "M13 22v-8h3l1-4h-4V7.5C13 6.4 13.4 5.5 15 5.5h2V2.2C16.5 2.1 15.3 2 14 2c-3 0-5 1.8-5 5v3H6v4h3v8h4z" },
            { key: "tiktok", url: social.tiktok, label: "TikTok", path: "M16 2c.3 1.7 1.3 3 2.8 3.8 1 .5 2 .7 3.2.7v3.6c-2 .1-3.8-.4-5.5-1.5v6.6c0 4-3.3 7.3-7.3 7.3S2 18.7 2 14.7s3.3-7.3 7.3-7.3c.4 0 .8 0 1.2.1v3.8c-.4-.1-.8-.2-1.2-.2-2 0-3.7 1.7-3.7 3.7s1.7 3.7 3.7 3.7 3.7-1.7 3.7-3.7V2h3z" },
            { key: "youtube", url: social.youtube, label: "YouTube", path: "M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8C22 15.2 22 12 22 12s0-3.2-.4-4.8zM10 15V9l5 3-5 3z" },
            { key: "whatsapp", url: social.whatsapp, label: "WhatsApp", path: "M20 4A11.9 11.9 0 0 0 3 18l-1 4 4-1a11.9 11.9 0 0 0 14-17zm-8 18a9.9 9.9 0 0 1-5-1.4l-.4-.2-2.4.6.7-2.3-.2-.4A9.9 9.9 0 1 1 12 22zm5.5-7c-.3-.2-1.8-.9-2-1s-.5-.2-.7.1-.8 1-1 1.2-.4.2-.6.1c-1.6-.7-2.8-2-3.4-3.4-.2-.4 0-.4.2-.6l.5-.6c.1-.2.2-.3.3-.5s0-.4 0-.5-.7-1.7-.9-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4S6 8.3 6 9.7s1 2.8 1.1 3 2 3.1 5 4.3c2.5 1 2.5.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.2-.3-.2-.6-.4z" },
          ].filter((s) => s.url);
          const hasAddress = !!shop?.address;
          const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop?.address || shop?.business_name || "")}`;
          const mapsEmbed = hasAddress ? `https://www.google.com/maps?q=${encodeURIComponent(shop.address)}&output=embed` : "";

          return (
            <footer
              id="contato"
              className="relative border-t border-[#F5C542]/10"
              style={{
                background: "radial-gradient(circle at top, rgba(245,197,66,0.08), transparent 40%), #02040A",
                padding: "clamp(48px, 6vw, 72px) clamp(20px, 4vw, 40px) 32px",
              }}
            >
              <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
                  {/* Col 1: brand */}
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      {shop.barbershop_logo_url ? (
                        <img src={shop.barbershop_logo_url} alt={shop.business_name} className="h-12 w-12 object-contain rounded-xl bg-white/5 p-1" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center">
                          <Scissors className="h-6 w-6 text-[#D4AF37]" />
                        </div>
                      )}
                      <h4 className="font-bold text-xl tracking-tight text-white truncate">{shop.business_name}</h4>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Tradição, estilo e cuidado masculino em um só lugar.
                    </p>
                    {socials.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {socials.map((s) => (
                          <a
                            key={s.key}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={s.label}
                            className="h-10 w-10 rounded-full bg-white/5 border border-[#F5C542]/25 flex items-center justify-center text-white/85 hover:text-[#F5C542] hover:border-[#F5C542] hover:shadow-[0_0_20px_rgba(245,197,66,0.45)] transition-all"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={s.path} /></svg>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Col 2: location + map */}
                  <div className="space-y-4">
                    <h5 className="font-black uppercase tracking-widest text-xs text-[#D4AF37]">Localização</h5>
                    {hasAddress ? (
                      <>
                        <div className="flex items-start gap-3">
                          <MapPin size={18} className="text-[#D4AF37] shrink-0 mt-0.5" />
                          <p className="text-slate-300 text-sm leading-relaxed">{shop.address}</p>
                        </div>
                        <div
                          className="w-full overflow-hidden rounded-[20px] border border-[#F5C542]/20 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)]"
                          style={{ height: "min(220px, 40vw)", minHeight: 180 }}
                        >
                          <iframe
                            src={mapsEmbed}
                            title="Mapa"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            className="w-full h-full"
                            style={{ border: 0, filter: "grayscale(0.4) contrast(1.05)" }}
                          />
                        </div>
                        <a
                          href={mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-bold text-[#D4AF37] hover:text-[#F5C542] transition-colors"
                        >
                          <ExternalLink size={14} /> Abrir no Google Maps
                        </a>
                      </>
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-[#F5C542]/20 bg-white/[0.02] p-6 text-center">
                        <MapPin size={20} className="text-[#D4AF37]/60 mx-auto mb-2" />
                        <p className="text-sm font-bold text-white">Localização não informada</p>
                        <p className="text-xs text-slate-500 mt-1">Esta barbearia ainda não cadastrou o endereço.</p>
                      </div>
                    )}
                  </div>

                  {/* Col 3: quick links */}
                  <div className="space-y-4">
                    <h5 className="font-black uppercase tracking-widest text-xs text-[#D4AF37]">Links Rápidos</h5>
                    <nav className="flex flex-col gap-2.5 text-sm font-medium text-slate-400">
                      <a href="#inicio" className="hover:text-white transition-colors">Início</a>
                      <a href="#servicos" className="hover:text-white transition-colors">Serviços</a>
                      <a href="#profissionais" className="hover:text-white transition-colors">Profissionais</a>
                      {isModuleEnabled("subscriptions") && (
                        <a href="#planos" className="hover:text-white transition-colors">Planos</a>
                      )}
                      {isModuleEnabled("products") && (
                        <a href="#produtos" className="hover:text-white transition-colors">Produtos</a>
                      )}
                      <a href={`/${slug}/portal`} className="hover:text-white transition-colors">Portal do Cliente</a>
                      <a href="/privacy" className="hover:text-white transition-colors">Política de Privacidade</a>
                      <a href="/terms" className="hover:text-white transition-colors">Termos de Uso</a>
                    </nav>
                  </div>

                  {/* Col 4: hours */}
                  <div className="space-y-4">
                    <h5 className="font-black uppercase tracking-widest text-xs text-[#D4AF37] flex items-center gap-2">
                      <Clock size={14} className="text-[#D4AF37]" />
                      Funcionamento
                    </h5>
                    <div className="space-y-2 text-sm text-slate-400 font-medium">
                      <div className="flex items-center justify-between gap-3 group rounded-lg px-3 py-2 bg-white/[0.02] border border-white/5 hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/[0.04] transition-all">
                        <span className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-[#D4AF37]/70 group-hover:text-[#D4AF37] transition-colors" />
                          Seg - Sex
                        </span>
                        <span className="text-white font-semibold flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                          09:00 - 20:00
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 group rounded-lg px-3 py-2 bg-white/[0.02] border border-white/5 hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/[0.04] transition-all">
                        <span className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-[#D4AF37]/70 group-hover:text-[#D4AF37] transition-colors" />
                          Sábado
                        </span>
                        <span className="text-white font-semibold flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                          08:00 - 18:00
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 group rounded-lg px-3 py-2 bg-white/[0.02] border border-white/5 hover:border-red-400/30 transition-all">
                        <span className="flex items-center gap-2">
                          <Ban size={14} className="text-red-400/70 group-hover:text-red-400 transition-colors" />
                          Domingo
                        </span>
                        <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
                          Fechado
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-[#F5C542]/10 flex flex-col md:flex-row justify-between items-center gap-3 text-center md:text-left">
                  <p className="text-xs text-slate-500">© 2026 {shop?.business_name}. Todos os direitos reservados.</p>
                  <p className="text-xs text-slate-600">Powered by <span className="text-[#D4AF37] font-bold">Barbex</span></p>
                </div>
              </div>
            </footer>
          );
        })()}

        {/* Mobile Bottom CTA removed — header + hero CTAs are sufficient */}

      </main>
    </>
  ) : isProfessionalsRoute ? (
    <section id="profissionais-pagina" className="py-24 bg-black min-h-screen">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-4 mb-12">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full text-white hover:bg-white/10" 
            onClick={() => navigate({ to: `/${slug}` })}
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="space-y-1">
            <span className="text-[#D4AF37] font-black uppercase tracking-[0.2em] text-xs">Nossa Equipe</span>
            <h3 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Profissionais</h3>
          </div>
        </div>

        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((barber, idx) => (
            <motion.div
              key={barber.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group cursor-pointer"
              onClick={() => {
                setModalBarber(barber);
                setIsServicesModalOpen(true);
              }}
            >
              <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden mb-6 shadow-2xl border border-white/5">
                {barber.avatar_url ? (
                  <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-[#1a1a1a]">
                    <UserIcon className="h-20 w-20 text-white/10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                
                <div className="absolute bottom-8 left-8 right-8 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[#D4AF37] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      {idx === 0 ? "Top Avaliado" : "Especialista"}
                    </span>
                  </div>
                  <h4 className="text-3xl font-black uppercase italic tracking-tighter text-white">{barber.name}</h4>
                  <div className="flex items-center gap-1.5">
                    <Star size={14} className="text-yellow-500" fill="currentColor" />
                    <span className="text-sm font-bold text-white">{barber.avg_rating ? Number(barber.avg_rating).toFixed(1) : "—"}</span>
                    <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest ml-1">({barber.total_ratings || 0} avaliações)</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  ) : (
    <Outlet />
  )}




      <Dialog open={isBookingOpen} onOpenChange={(open) => {
        setIsBookingOpen(open);
        if (!open) {
          // If logged in via portal, we might want to stay on step 2/3 on next open if it was already chosen
          // but usually it's better to reset to step 1 (where it will auto-identify and skip)
          const isPortalActive = !!localStorage.getItem(`client_portal_session_${slug}`);
          setBookingStep(1);
          setUseCashback(false);
          setUseCredits(false);
          setPaymentMethod(null);
        }
      }}>

        <DialogContent className={cn("p-0 overflow-hidden bg-white border-2 border-[#D4AF37] h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl [&>button.absolute]:right-4 [&>button.absolute]:top-4 [&>button.absolute]:h-10 [&>button.absolute]:w-10 [&>button.absolute]:rounded-full [&>button.absolute]:bg-black/80 [&>button.absolute]:backdrop-blur [&>button.absolute]:text-white [&>button.absolute]:opacity-100 [&>button.absolute]:flex [&>button.absolute]:items-center [&>button.absolute]:justify-center [&>button.absolute]:shadow-xl [&>button.absolute]:hover:bg-red-600 [&>button.absolute]:hover:text-white [&>button.absolute]:transition-colors [&>button.absolute>svg]:h-5 [&>button.absolute>svg]:w-5 [&>button.absolute]:z-50", bookingStep === 1 ? "sm:max-w-[920px]" : "sm:max-w-[480px]", isEmbedded && "w-full max-w-full m-0 h-full rounded-none border-none")}>
          <div className={cn("flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-gradient-to-b from-white/[0.02] to-transparent", bookingStep === 1 ? "p-0" : "p-6 sm:p-8")}>
          {!isEmbedded && bookingStep > 1 && (
            <DialogHeader className="flex-row items-center justify-between space-y-0 pb-6 shrink-0 border-b border-gray-100 mb-6">

              <div className="flex items-center gap-3">
                {bookingStep > 1 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 text-black" 
                    onClick={() => {
                      if (bookingStep === 5 && paymentMethod) {
                        setPaymentMethod(null);
                      }
                      setBookingStep(prev => prev - 1);
                    }}
                  >
                    <ArrowLeft size={20} />
                  </Button>
                )}
                <DialogTitle className="text-xl font-bold tracking-tight text-black">
                  {bookingStep === 1 && "Bem-vindo"}
                  {bookingStep === 2 && "O que faremos?"}
                  {bookingStep === 3 && "Quem atende?"}
                  {bookingStep === 4 && "Quando?"}
                  {bookingStep === 5 && "Confirmar"}
                </DialogTitle>
              </div>
            </DialogHeader>
          )}

          <div className={cn("flex-1", bookingStep === 1 ? "" : "pr-1")}>
            {bookingStep === 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid md:grid-cols-2 min-h-full"
              >
                {/* Coluna esquerda: imagem premium */}
                <div className="relative h-[180px] md:h-auto md:min-h-[560px] overflow-hidden md:rounded-l-[2.25rem]">
                  <img
                    src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=80"
                    alt="Barbearia"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-[#D4AF37]/30 md:rounded-l-[2.25rem] pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/95 text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                      <CalendarDays size={12} /> Agendamento
                    </span>
                    <h3 className="mt-3 text-white text-2xl md:text-3xl font-black tracking-tight leading-tight drop-shadow-lg">
                      Agende seu horário
                    </h3>
                    <p className="mt-2 text-white/85 text-sm md:text-[15px] font-medium leading-snug max-w-xs drop-shadow">
                      Escolha seu serviço, profissional favorito e garanta seu atendimento com praticidade.
                    </p>
                  </div>
                </div>

                {/* Coluna direita: formulário */}
                <div className="flex flex-col p-6 md:p-8 gap-5">
                  <div className="space-y-1.5">
                    <h4 className="text-2xl md:text-[26px] font-black text-black tracking-tight leading-tight">
                      Bem-vindo à {shop.business_name}
                    </h4>
                    <p className="text-zinc-600 text-sm font-medium leading-snug">
                      Informe seu WhatsApp para começarmos seu agendamento de forma rápida e segura.
                    </p>
                    <p className="text-[11px] text-zinc-500 leading-snug pt-1">
                      Você poderá escolher serviço, profissional, data e horário nos próximos passos.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-4 transition-all duration-300">
                      <div className="flex justify-between items-center mb-2.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1 flex items-center gap-1.5">
                          <MessageSquare size={12} className="text-[#D4AF37]" /> Seu WhatsApp
                        </Label>
                        {(submitting || isSearchingCustomer) && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600 animate-pulse">
                            Buscando...
                          </span>
                        )}
                      </div>
                      <div className="relative group international-phone-portal">
                        <PhoneInput
                          defaultCountry={typeof window !== 'undefined' ? (navigator.language.split('-')[1]?.toLowerCase() || 'br') : 'br'}
                          value={customerPhone}
                          onChange={(phone) => setCustomerPhone(phone)}
                          placeholder="(71) 99999-9999"
                          className="relative z-10 w-full"
                          inputClassName="!w-full !h-14 !bg-white !border-zinc-200 !text-lg !font-semibold !text-black !placeholder:text-zinc-400 focus:!outline-none !pl-4 !rounded-xl"
                          countrySelectorStyleProps={{
                            buttonClassName: "!h-14 !bg-white !border-zinc-200 !px-3 !rounded-l-xl hover:!bg-zinc-50 transition-colors",
                          }}
                        />
                        <style>{`
                          .international-phone-portal .react-international-phone-input-container { width: 100%; border: none; background: transparent; }
                          .international-phone-portal .react-international-phone-input { width: 100% !important; border: 1px solid #e4e4e7 !important; border-radius: 0.75rem !important; }
                          .international-phone-portal .react-international-phone-country-selector-button { border: 1px solid #e4e4e7 !important; border-right: none !important; border-radius: 0.75rem 0 0 0.75rem !important; }
                        `}</style>
                      </div>

                      <AnimatePresence mode="wait">
                        {normalizePhone(customerPhone).length >= 10 && !isSearchingCustomer && (
                          <motion.div
                            key={customerId ? "found" : "new"}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-3"
                          >
                            {customerId ? (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                  <CheckCircle2 className="text-emerald-600" size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base font-bold text-emerald-900 tracking-tight leading-tight truncate">
                                    Olá, {customerName.split(' ')[0]}! 👋
                                  </h3>
                                  <p className="text-[11px] text-emerald-700 font-medium">Que bom ter você de volta!</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block ml-1">Primeira vez por aqui? Qual o seu nome?</Label>
                                <Input
                                  placeholder="Digite seu nome completo"
                                  value={customerName}
                                  onChange={(e) => setCustomerName(e.target.value)}
                                  className="bg-white text-black border border-zinc-200 placeholder:text-zinc-400 rounded-xl h-12 text-base font-medium focus-visible:ring-[#D4AF37]/50"
                                />
                              </div>
                            )}
                            {customerId && activeSubscription && (
                              <div className="mt-3 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100 p-3.5 shadow-md">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Crown className="text-amber-600" size={16} />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Plano Ativo</span>
                                </div>
                                <p className="text-sm font-bold text-amber-900">{activeSubscription.plan?.name || "Assinatura"}</p>
                                {activeSubscription.next_billing_at && (
                                  <p className="text-[11px] text-amber-700 mt-0.5">
                                    Renovação: {format(parseISO(activeSubscription.next_billing_at), "dd/MM/yyyy", { locale: ptBR })}
                                  </p>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Benefícios */}
                    <ul className="grid grid-cols-1 gap-1.5 px-1">
                      {[
                        "Agendamento rápido",
                        "Escolha seu barbeiro",
                        "Confirmação pelo WhatsApp",
                        ...(shop.subscriptions_enabled ? ["Benefícios para assinantes"] : []),
                      ].map((b) => (
                        <li key={b} className="flex items-center gap-2 text-[12.5px] text-zinc-700 font-medium">
                          <span className="h-5 w-5 rounded-full bg-[#D4AF37]/15 text-[#B8860B] flex items-center justify-center shrink-0">
                            <CheckCircle2 size={13} />
                          </span>
                          {b}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 space-y-2 rounded-xl bg-zinc-50 border border-zinc-200 p-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consentAccepted}
                          onChange={(e) => setConsentAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-[#D97706] shrink-0"
                        />
                        <span className="text-[12px] leading-snug text-zinc-700">
                          Li e concordo com a{" "}
                          <Link to="/privacy" target="_blank" className="font-semibold text-[#B8860B] underline underline-offset-2">
                            Política de Privacidade
                          </Link>{" "}
                          e os{" "}
                          <Link to="/terms" target="_blank" className="font-semibold text-[#B8860B] underline underline-offset-2">
                            Termos de Uso
                          </Link>
                          .
                        </span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowMarketing}
                          onChange={(e) => setAllowMarketing(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-[#D97706] shrink-0"
                        />
                        <span className="text-[12px] leading-snug text-zinc-600">
                          Quero receber promoções, novidades e campanhas (opcional).
                        </span>
                      </label>
                    </div>

                    <Button
                      className="w-full h-14 rounded-2xl font-extrabold text-black text-base tracking-tight transition-all duration-200 hover:brightness-105 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      style={{
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        boxShadow: '0 12px 28px rgba(245,158,11,.28)',
                      }}
                      onClick={handlePhoneCheck}
                      disabled={!consentAccepted || !customerPhone || submitting || isSearchingCustomer || (normalizePhone(customerPhone).length >= 10 && !customerId && (!customerName || customerName.trim().length < 3))}
                    >
                      {submitting ? "Verificando..." : "Continuar agendamento"}
                    </Button>
                  </div>

                  <div className="mt-auto pt-3 border-t border-zinc-100">
                    <div className="flex items-start gap-2">
                      <LockIcon size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[12px] font-bold text-zinc-700 leading-tight">Seus dados estão seguros</p>
                        <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">
                          Usamos seu WhatsApp apenas para identificar seu cadastro e enviar informações do agendamento.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {bookingStep === 2 && activeSubscription && !bookingMode && (() => {
              const plan = activeSubscription.plan;
              const used = subUsage.total_uses_consumed;
              const max = subUsage.total_uses_allowed || (plan?.max_uses_per_month ?? null);
              const reserved = subUsage.total_uses_reserved;
              const available = max ? Math.max(0, max - used - reserved) : null;
              const remaining = max ? Math.max(0, max - used) : null;
              const noBenefit = (available !== null && available === 0) || subPlanServices.length === 0;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  {/* Subscription summary - Premium dark */}
                  <div className="relative rounded-2xl overflow-hidden border-2 border-[#D4AF37]/60 bg-gradient-to-br from-[#0a0a0a] via-[#1a1408] to-[#0a0a0a] p-5 shadow-[0_12px_40px_rgba(212,175,55,0.25)]">
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                      style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #D4AF37 1px, transparent 1px), radial-gradient(circle at 80% 80%, #D4AF37 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                    <div className="relative flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Crown className="text-[#D4AF37]" size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4AF37]">Assinante Premium</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-black">
                        {activeSubscription.status === "active" ? "ATIVO" : activeSubscription.status?.toUpperCase()}
                      </span>
                    </div>
                    <p className="relative text-white text-xl font-black leading-tight">{plan?.name || "Assinatura"}</p>
                    {benefitBalances.length > 0 ? (
                      <div className="relative space-y-2 mt-4">
                        {benefitBalances.map((b: any) => {
                          const pct = b.monthly_limit > 0 ? Math.min(100, (b.used / b.monthly_limit) * 100) : 0;
                          return (
                            <div key={b.benefit_key} className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300">{b.benefit_name}</p>
                                <p className="text-[11px] font-black text-[#D4AF37]">{b.used}/{b.monthly_limit}</p>
                              </div>
                              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#B8941F]" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest pt-1">
                          <span className="text-gray-500 font-bold">Renovação</span>
                          <span className="text-white font-black">
                            {activeSubscription.next_billing_at
                              ? format(parseISO(activeSubscription.next_billing_at), "dd/MM", { locale: ptBR })
                              : activeSubscription.current_period_end
                                ? format(parseISO(activeSubscription.current_period_end), "dd/MM", { locale: ptBR })
                                : "—"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative space-y-2 mt-4">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2">
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Utilizados</p>
                            <p className="text-lg font-black text-white mt-0.5">{used}{max ? `/${max}` : ""}</p>
                          </div>
                          <div className="bg-black/40 border border-emerald-500/20 rounded-lg p-2">
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Restantes</p>
                            <p className="text-lg font-black text-emerald-400 mt-0.5">{remaining ?? "∞"}</p>
                          </div>
                          <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2">
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Renovação</p>
                            <p className="text-[11px] font-black text-white mt-0.5">
                              {activeSubscription.next_billing_at
                                ? format(parseISO(activeSubscription.next_billing_at), "dd/MM", { locale: ptBR })
                                : activeSubscription.current_period_end
                                  ? format(parseISO(activeSubscription.current_period_end), "dd/MM", { locale: ptBR })
                                  : "—"}
                            </p>
                          </div>
                        </div>
                        {(subUsage.haircut_allowed > 0 || subUsage.beard_allowed > 0) && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2">
                              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Cortes</p>
                              <p className="text-sm font-black text-white mt-0.5">{subUsage.haircut_used}/{subUsage.haircut_allowed}</p>
                            </div>
                            <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2">
                              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Barbas</p>
                              <p className="text-sm font-black text-white mt-0.5">{subUsage.beard_used}/{subUsage.beard_allowed}</p>
                            </div>
                          </div>
                        )}
                        {reserved > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/40 border border-amber-400/30 rounded-lg p-2">
                              <p className="text-[9px] text-amber-300/80 uppercase tracking-widest font-bold">Reservados</p>
                              <p className="text-sm font-black text-amber-300 mt-0.5">{reserved}</p>
                            </div>
                            <div className="bg-black/40 border border-emerald-500/20 rounded-lg p-2">
                              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Disp. p/ agendar</p>
                              <p className="text-sm font-black text-emerald-400 mt-0.5">{available ?? "∞"}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>


                  <h5 className="text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37]">Como deseja agendar?</h5>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      disabled={subPlanServices.length === 0}
                      onClick={() => {
                        if (available !== null && available === 0) {
                          setExhaustedReason('empty');
                          setExhaustedServiceName(null);
                          setExhaustedOpen(true);
                          return;
                        }
                        setBookingMode('benefit');
                      }}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all",
                        subPlanServices.length === 0
                          ? "border-zinc-300 bg-zinc-100 opacity-60 cursor-not-allowed"
                          : (available !== null && available === 0)
                            ? "border-amber-400/70 bg-gradient-to-br from-amber-50 via-white to-amber-50 hover:border-amber-500 hover:shadow-lg cursor-pointer"
                            : "border-[#D4AF37]/60 bg-gradient-to-br from-[#fff9e6] via-white to-[#fff9e6] hover:border-[#D4AF37] hover:shadow-[0_12px_40px_rgba(212,175,55,0.3)] hover:scale-[1.01] cursor-pointer"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#8a6d12] grid place-items-center text-black shrink-0">
                            <Crown size={22} />
                          </div>
                          <div>
                            <p className="font-black uppercase tracking-tight text-base text-black">Utilizar Benefício</p>
                            <p className="text-[11px] text-zinc-600 font-medium">
                              {subPlanServices.length === 0
                                ? "Plano sem serviços vinculados"
                                : (available !== null && available === 0)
                                  ? "Utilizações esgotadas neste ciclo • ver opções"
                                  : `${subPlanServices.length} serviço(s) incluso(s) • R$ 0,00`}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-[#D4AF37] shrink-0" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBookingMode('standalone')}
                      className="group relative overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white p-5 text-left transition-all hover:border-zinc-400 hover:shadow-lg hover:scale-[1.01] cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-zinc-900 grid place-items-center text-white shrink-0">
                            <Scissors size={22} />
                          </div>
                          <div>
                            <p className="font-black uppercase tracking-tight text-base text-black">Serviço Avulso</p>
                            <p className="text-[11px] text-zinc-500 font-medium">Catálogo completo • PIX, créditos, cashback</p>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-zinc-400 shrink-0" />
                      </div>
                    </button>
                  </div>
                </motion.div>
              );
            })()}

            {bookingStep === 2 && (!activeSubscription || bookingMode) && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Premium benefit ribbon when in benefit mode */}
                {activeSubscription && bookingMode === 'benefit' && (() => {
                  const max = subUsage.total_uses_allowed || (activeSubscription.plan?.max_uses_per_month ?? null);
                  const remaining = max ? Math.max(0, max - subUsage.total_uses_consumed - subUsage.total_uses_reserved) : null;
                  return (
                    <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#D4AF37]/60 bg-gradient-to-r from-[#1a1408] to-[#0a0a0a] p-3 text-white shadow-[0_8px_24px_rgba(212,175,55,0.2)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Crown size={16} className="text-[#D4AF37] shrink-0" />
                        <p className="text-[11px] font-black uppercase tracking-widest truncate">
                          Modo Benefício • {remaining ?? "∞"} restante(s)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBookingMode(null)}
                        className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] hover:text-white transition-colors shrink-0"
                      >
                        Trocar
                      </button>
                    </div>
                  );
                })()}

                {activeSubscription && bookingMode === 'standalone' && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Scissors size={14} className="text-zinc-500 shrink-0" />
                      <p className="text-[11px] font-black uppercase tracking-widest text-zinc-700 truncate">Serviço Avulso</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBookingMode(null)}
                      className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-black transition-colors shrink-0"
                    >
                      Trocar
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  <h5 className="text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37]">Selecione o Serviço</h5>
                  <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {(bookingMode === 'benefit'
                      ? services.filter((s) => subPlanServices.some((ps: any) => ps.service_id === s.id))
                      : services
                    ).map(s => {
                      const elig = serviceEligibility[s.id];
                      const isCovered = !!(elig && elig.has_active_subscription && Number(elig.covered_amount || 0) > 0 && Number(elig.extra_amount || 0) === 0);
                      const isPartial = !!(elig && elig.has_active_subscription && Number(elig.covered_amount || 0) > 0 && Number(elig.extra_amount || 0) > 0);
                      const consumesFor = planBenefitServices.filter((l: any) => l.service_id === s.id);
                      const totalConsume = consumesFor.reduce((acc: number, l: any) => acc + Number(l.consume_quantity || 1), 0);
                      return (
                      <motion.div 
                        key={s.id} 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-4 transition-all duration-300 hover:shadow-lg hover:border-zinc-300 cursor-pointer flex justify-between items-center group relative overflow-hidden",
                          selectedService?.id === s.id ? "border-sky-600 ring-2 ring-sky-600/20" : "",
                          isCovered ? "border-[#D4AF37]/60 ring-1 ring-[#D4AF37]/30" : ""
                        )}
                        onClick={() => {
                          if (!isEmbedded && (!customerName || customerName.length < 3)) {
                            toast.error("Por favor, informe seu nome primeiro.");
                            return;
                          }
                          // Block benefit usage when service consumes more than available
                          if (bookingMode === 'benefit' && subUsage.has_limits) {
                            const need = totalConsume > 0 ? totalConsume : 1;
                            if (subUsage.total_uses_available < need) {
                              setExhaustedReason(need > 1 ? 'combo' : 'empty');
                              setExhaustedServiceName(s.name);
                              setExhaustedOpen(true);
                              return;
                            }
                          }
                          setSelectedService(s);
                          setBookingStep(3);
                        }}
                      >
                        <div className="relative z-10">
                          <p className={cn("font-black uppercase tracking-tight text-lg", selectedService?.id === s.id ? "text-sky-700" : "text-black")}>{s.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                             <Clock size={12} className={selectedService?.id === s.id ? "text-sky-600" : "text-gray-400"} />
                             <p className={cn("text-[10px] font-black uppercase tracking-widest", selectedService?.id === s.id ? "text-sky-600" : "text-gray-400")}>{s.duration_minutes} min</p>
                             {isCovered && (
                               <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8941F] text-black text-[9px] font-black uppercase tracking-wider shadow-sm">
                                 ✦ Incluso no Plano
                               </span>
                             )}
                             {isPartial && (
                               <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#8A6D1F] text-[9px] font-black uppercase tracking-wider">
                                 Parcial pelo Plano
                               </span>
                             )}
                          </div>
                          {bookingMode === 'benefit' && consumesFor.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {consumesFor.map((l: any) => (
                                <p key={l.benefit_key} className="text-[10px] text-zinc-600">
                                  Consome: <span className="font-bold text-[#8A6D1F]">{l.consume_quantity} utilização de {l.benefit_name}</span>
                                </p>
                              ))}
                              {totalConsume > 1 && (
                                <p className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">Total: {totalConsume} utilizações</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right relative z-10">
                          {isCovered ? (
                            <>
                              <p className="font-black text-xl text-emerald-600">R$ 0,00</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 line-through">R$ {s.price.toFixed(2)}</p>
                            </>
                          ) : isPartial ? (
                            <>
                              <p className="font-black text-xl text-[#8A6D1F]">R$ {Number(elig.extra_amount).toFixed(2)}</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">de R$ {s.price.toFixed(2)}</p>
                            </>
                          ) : (
                            <p className={cn("font-black text-xl", selectedService?.id === s.id ? "text-sky-600" : "text-black")}>R$ {s.price.toFixed(2)}</p>
                          )}
                        </div>
                      </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {bookingStep === 3 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-5 transition-all duration-300">
                  <Label className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 block">Data Desejada</Label>
                  <Input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)} 
                    min={format(new Date(), "yyyy-MM-dd")} 
                    className="bg-white border-zinc-200 text-black h-12 text-lg font-bold rounded-xl focus-visible:ring-sky-600/50"
                  />
                </div>

                <div className="space-y-4">
                  <h5 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Quem irá te atender?</h5>
                  
                  {loadingDayData ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-sky-600" />
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Buscando disponibilidades...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {barbers
                        .filter(b => isBarberAvailableOnDate(b, selectedDate, selectedService, dayAppointments))
                        .map(b => (
                        <motion.div 
                          key={b.id} 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-5 transition-all duration-300 hover:shadow-lg hover:border-zinc-300 cursor-pointer text-center space-y-3 relative overflow-hidden group",
                            selectedBarber?.id === b.id ? "border-sky-600 ring-2 ring-sky-600/20 shadow-sky-100" : ""
                          )}
                          onClick={() => {
                            setSelectedBarber(b);
                            setBookingStep(4);
                          }}
                        >
                          <div className="relative z-10">
                            <div className="h-16 w-16 rounded-2xl bg-zinc-100 mx-auto overflow-hidden border border-zinc-200 group-hover:border-sky-400 transition-colors">
                              {b.avatar_url ? (
                                <img src={b.avatar_url} className="h-full w-full object-cover" alt={b.name} />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center font-black text-xl text-zinc-400">{b.name?.[0] || '?'}</div>
                              )}
                            </div>
                            <div className="mt-3">
                              <p className={cn("font-bold uppercase tracking-tight text-sm leading-none", selectedBarber?.id === b.id ? "text-sky-700" : "text-black")}>{b.name}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-1">{b.specialty || 'Especialista'}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {bookingStep === 4 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-5 transition-all duration-300 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-zinc-100 border border-zinc-200 overflow-hidden text-zinc-400">
                      {selectedBarber?.avatar_url ? <img src={selectedBarber.avatar_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center font-black text-lg">{selectedBarber?.name?.[0] || '?'}</div>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Profissional</p>
                      <p className="text-lg font-black uppercase tracking-tight text-zinc-900">{selectedBarber?.name}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setBookingStep(3)} className="bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-200 rounded-xl font-medium transition-all duration-200 h-9 px-4">Alterar</Button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full animate-pulse bg-sky-500" />
                    <h5 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Horários Disponíveis</h5>
                  </div>
                  
                  {fetchingTimes ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-sky-600" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Buscando horários...</p>
                    </div>

                  ) : availableTimes.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-1">
                      {availableTimes.map(time => {
                        const isSelected = selectedTime === time;
                        return (
                          <motion.button
                            key={time}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              "relative h-12 rounded-xl text-lg font-black tracking-tight transition-all border flex items-center justify-center gap-2 overflow-hidden group",
                                isSelected 
                                  ? "bg-primary text-white border-primary shadow-md" 
                                  : "bg-white border-zinc-200 text-zinc-500 hover:border-primary/50 hover:text-primary hover:shadow-md hover:shadow-zinc-100"
                            )}
                          >
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="absolute top-2 right-2"
                              >
                                <CheckCircle2 size={14} className="text-white" />
                              </motion.div>
                            )}
                            
                            <span className="relative z-10">{time}</span>
                            
                            {/* Background interactive glow */}
                            {!isSelected && (
                              <div 
                                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"
                                style={{ backgroundColor: primaryColor }}
                              />
                            )}

                            {/* Reflection effect for selected */}
                            {isSelected && (
                              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>

                  ) : (
                    <div className="text-center py-12 bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-800">
                      <Clock className="mx-auto h-8 w-8 text-zinc-700 mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500">
                        Nenhum horário disponível para esta data.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="outline"
                    className="h-14 bg-white text-black hover:bg-zinc-50 border border-zinc-200 rounded-xl font-medium transition-all duration-200"
                    onClick={addToBookingCart}
                    disabled={!selectedTime}
                  >
                    + Adicionar outro
                  </Button>
                  <Button 
                    className="h-14 bg-black text-white hover:bg-zinc-800 rounded-xl font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      if (!selectedTime) {
                        toast.error("Por favor, selecione um horário.");
                        return;
                      }
                      setBookingStep(5);
                      // Clear payment method when moving to checkout to ensure fresh choice
                      setPaymentMethod(null);
                    }}
                    disabled={fetchingTimes || !selectedTime}
                  >
                    Ir para Checkout
                  </Button>
                </div>

              </motion.div>
            )}

            {bookingStep === 5 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
                onViewportEnter={() => {
                  console.log('DEBUG: PAYMENT STEP REACHED');
                  console.log('CUSTOMER ID', customerId);
                  console.log('CUSTOMER NAME', customerName);
                  console.log('CREDITS', customerCredits);
                  console.log('CASHBACK', customerCashback);
                  console.log('SERVICE TOTAL', calculateTotalBeforeCashback());
                }}
              >
                {/* Your Booking Cart Section */}
                {(bookingCart.length > 0 || selectedService) && (
                  <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-6 space-y-4 transition-all duration-300">
                    <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={14} /> Seu Agendamento ({bookingCart.length + (selectedService ? 1 : 0)})
                    </h5>
                    <div className="space-y-3">
                      {bookingCart.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-zinc-100 rounded-2xl shadow-sm group relative">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-black uppercase truncate">{item.service_name}</p>
                            <p className="text-[10px] font-bold text-zinc-500">{item.barber_name} • {item.start_time}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-black">R$ {item.price.toFixed(2)}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-zinc-400 hover:text-red-500 transition-colors"
                              onClick={() => removeFromBookingCart(item.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {selectedService && (
                        <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-2xl shadow-sm group relative">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-black uppercase truncate">{selectedService.name}</p>
                            <p className="text-[10px] font-bold text-zinc-500">{selectedBarber?.name} • {selectedTime}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-black">R$ {selectedService.price.toFixed(2)}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-zinc-400 hover:text-red-500 transition-colors"
                              onClick={() => {
                                setSelectedService(null);
                                setSelectedBarber(null);
                                setSelectedTime("");
                                if (bookingCart.length === 0) setBookingStep(2);
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      )}

                      <Button 
                        variant="link" 
                        className="text-[10px] font-black uppercase tracking-widest text-zinc-500 h-auto p-0"
                        onClick={() => {
                          if (selectedService && selectedBarber && selectedDate && selectedTime) {
                            addToBookingCart();
                          } else {
                            setBookingStep(2);
                          }
                        }}
                      >
                        + Adicionar outro serviço
                      </Button>
                    </div>
                  </div>
                )}

                {/* Highlight Cards for Balance */}
                <div className="space-y-3">
                  {cashbackEnabled && shop.cashback_enabled && customerCashback > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-5 transition-all duration-300 hover:shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                            <Gift size={24} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Cashback Disponível</p>
                            <p className="text-lg font-black text-zinc-900 leading-none">R$ {customerCashback.toFixed(2)}</p>
                          </div>
                        </div>
                        <Button 
                          variant={useCashback ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => setUseCashback(!useCashback)}
                          className={cn(
                            "rounded-xl font-medium transition-all duration-200 h-10 px-6", 
                            useCashback 
                              ? "bg-black text-white hover:bg-zinc-800" 
                              : "bg-white text-black hover:bg-zinc-50 border border-zinc-200"
                          )}
                        >
                          {useCashback ? "Aplicado" : "Usar"}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {customerCredits > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-5 transition-all duration-300 hover:shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-900">
                            <CircleDollarSign size={24} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-zinc-900 uppercase tracking-widest mb-0.5">Créditos Disponíveis</p>
                            <p className="text-lg font-black text-zinc-900 leading-none">R$ {customerCredits.toFixed(2)}</p>
                          </div>
                        </div>
                        <Button 
                          variant={useCredits ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => setUseCredits(!useCredits)}
                          className={cn(
                            "rounded-xl font-medium transition-all duration-200 h-10 px-6", 
                            useCredits 
                              ? "bg-black text-white hover:bg-zinc-800" 
                              : "bg-white text-black hover:bg-zinc-50 border border-zinc-200"
                          )}
                        >
                          {useCredits ? "Aplicado" : "Usar Créditos"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {couponsEnabled && (
                <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-6 space-y-4 transition-all duration-300 hover:shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center">
                      <TicketPercent size={20} className="text-zinc-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tem um cupom?</p>
                      <p className="text-sm font-bold text-zinc-900">Aplicar desconto</p>
                    </div>
                  </div>

                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                      <div className="flex items-center gap-3">
                        <Tag size={18} className="text-zinc-900" />
                        <div>
                          <p className="text-sm font-bold text-zinc-900 uppercase">{appliedCoupon.code}</p>
                          <p className="text-[10px] font-black text-emerald-600 uppercase">
                            Cupom Aplicado: -R$ {calculateDiscount().toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setAppliedCoupon(null)}
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input 
                        placeholder="CÓDIGO DO CUPOM" 
                        className="bg-white text-black border border-zinc-300 placeholder:text-zinc-500 rounded-xl font-bold uppercase tracking-wider h-12"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      />
                      <Button 
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon || !couponCode.trim()}
                        className="bg-black text-white hover:bg-zinc-800 rounded-xl font-semibold shadow-md transition-all duration-200 h-12 px-6"
                      >
                        {isApplyingCoupon ? <RefreshCcw size={18} className="animate-spin" /> : "Aplicar"}
                      </Button>
                    </div>
                  )}
                </div>
                )}




                {productsEnabled && products.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Produtos Adicionais</Label>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary" style={{ color: primaryColor }}>Opcional</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pb-6 px-1">
                    {products.map(p => {
                      const cartItem = selectedProducts.find(sp => sp.id === p.id);
                      return (
                        <motion.div 
                          key={p.id}
                          whileHover={{ y: -4 }}
                          className={cn(
                            "group relative flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden bg-white text-black shadow-lg shadow-black/5",
                            cartItem 
                              ? "border-black ring-1 ring-black shadow-xl" 
                              : "border-zinc-200 hover:border-zinc-300 hover:shadow-xl"
                          )}
                        >
                          {/* Image Container */}
                          <div className="relative aspect-video w-full overflow-hidden bg-zinc-100">
                            {p.image_url ? (
                              <img 
                                src={p.image_url} 
                                alt={p.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                <Package size={48} strokeWidth={1} />
                              </div>
                            )}
                            
                            {/* Badges Overlay */}
                            <div className="absolute top-3 right-3 flex flex-col gap-2">
                              {cartItem && (
                                <motion.div 
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5 shadow-lg bg-black"
                                >
                                  <CheckCircle2 size={12} /> Selecionado
                                </motion.div>
                              )}
                              {p.badge && !cartItem && (
                                <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/90 text-zinc-600 backdrop-blur-md border border-zinc-200">
                                  {p.badge}
                                </div>
                              )}
                            </div>

                            {/* Price Badge Overlay */}
                            <div className="absolute bottom-3 left-3">
                              <div className="px-3 py-1.5 rounded-xl bg-white/95 border border-zinc-100 text-black font-bold text-sm shadow-sm">
                                R$ {p.price.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="p-5 flex flex-col flex-1">
                            <div className="mb-3">
                              <h4 className="text-zinc-900 font-bold text-lg leading-tight mb-1 line-clamp-2 group-hover:text-black transition-colors">
                                {p.name}
                              </h4>
                              {(p.short_description || p.description) && (
                                <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed break-words">
                                  {p.short_description || p.description}
                                </p>
                              )}
                            </div>

                            <div className="mt-auto space-y-3">
                              {cartItem ? (
                                <div className="flex items-center justify-between bg-zinc-50 rounded-xl p-1.5 border border-zinc-100">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, -1); }} 
                                    className="hover:bg-zinc-200 text-black rounded-lg h-9 w-9 flex items-center justify-center transition-colors"
                                  >
                                    <Minus size={16} />
                                  </button>
                                  <span className="text-sm font-bold text-zinc-900 w-24 text-center">{cartItem.quantity} unidades</span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, 1); }} 
                                    className="hover:bg-zinc-200 text-black rounded-lg h-9 w-9 flex items-center justify-center transition-colors"
                                    disabled={cartItem.quantity >= (p.stock_quantity || 99)}
                                  >
                                    <Plus size={16} />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => toggleProduct(p)}
                                  className="bg-black text-white hover:bg-zinc-800 rounded-xl font-medium transition-all duration-200 h-11 w-full"
                                >
                                  <Plus size={16} className="mr-1.5 shrink-0" /> Adicionar
                                </Button>
                              )}
                              
                              {cartItem && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleProduct(p)}
                                  className="w-full h-9 text-[10px] uppercase font-bold tracking-widest text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  Remover do Carrinho
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
                )}

                <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-6 space-y-4 transition-all duration-300 hover:shadow-xl">
                  <div className="flex items-center gap-3 pb-2 border-b border-zinc-100 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center">
                      <Calendar size={20} className="text-zinc-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Resumo do Agendamento</p>
                      <p className="text-sm font-bold text-zinc-900">Confira os detalhes abaixo</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    {/* Lista de Serviços */}
                    <div className="space-y-3">
                      {bookingCart.map((item) => {
                        const elig = serviceEligibility[item.service_id];
                        const covered = elig?.has_active_subscription && elig?.service_included && !elig?.requires_payment;
                        const partial = elig?.has_active_subscription && elig?.service_included && elig?.requires_payment && elig?.reason === 'partial_coverage';
                        return (
                          <div key={item.id} className="flex flex-col gap-1 pb-3 border-b border-zinc-100 last:border-b-0 relative group">
                            <button 
                              onClick={() => removeFromBookingCart(item.id)}
                              className="absolute right-0 top-0 p-1 text-zinc-400 hover:text-red-500 transition-colors"
                              title="Remover serviço"
                            >
                              <Trash2 size={14} />
                            </button>
                            <div className="flex justify-between items-center pr-8">
                              <span className="font-bold text-zinc-900">{item.service_name}</span>
                              <span className={cn("font-bold", covered ? "text-emerald-600 line-through" : "text-zinc-900")}>R$ {(item.price || 0).toFixed(2)}</span>
                            </div>
                            {covered && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 w-fit">
                                <Crown size={10} /> Coberto pelo plano · 0,00
                              </span>
                            )}
                            {partial && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 w-fit">
                                <Crown size={10} /> Plano cobre R$ {Number(elig?.covered_amount || 0).toFixed(2)} · diferença R$ {Math.max(0, item.price - Number(elig?.covered_amount || 0)).toFixed(2)}
                              </span>
                            )}
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              <span className="flex items-center gap-1.5"><UserIcon size={10} /> {item.barber_name}</span>
                              <span>{format(parseISO(item.date), "dd/MM/yyyy")} às {item.start_time}</span>
                            </div>
                          </div>
                        );
                      })}


                      {selectedService && (
                        <div className="flex flex-col gap-1 pb-3 border-b border-zinc-100 last:border-b-0 relative group">
                          <button 
                            onClick={() => {
                              setSelectedService(null);
                              setSelectedBarber(null);
                              setSelectedTime("");
                              if (bookingCart.length === 0) setBookingStep(2);
                            }}
                            className="absolute right-0 top-0 p-1 text-zinc-400 hover:text-red-500 transition-colors"
                            title="Remover serviço"
                          >
                            <Trash2 size={14} />
                          </button>
                          <div className="flex justify-between items-center pr-8">
                            <span className="font-bold text-zinc-900">{selectedService.name}</span>
                            <span className="text-zinc-900 font-bold">R$ {(selectedService.price || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <span className="flex items-center gap-1.5"><UserIcon size={10} /> {selectedBarber?.name}</span>
                            <span>{format(parseISO(selectedDate), "dd/MM/yyyy")} às {selectedTime}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {selectedProducts.length > 0 && (
                      <div className="space-y-3 py-3 border-y border-zinc-100 my-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Produtos Adicionados</p>
                          <span className="text-[10px] font-bold text-zinc-400">{selectedProducts.length} itens</span>
                        </div>
                        {selectedProducts.map(p => (
                          <div key={p.id} className="flex justify-between items-center text-xs pl-3 relative group">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-zinc-200" />
                            <span className="text-zinc-600">{p.name} <span className="text-zinc-900 font-bold ml-1">x{p.quantity || 1}</span></span>
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-900 font-bold">R$ {((p.price || 0) * (p.quantity || 1)).toFixed(2)}</span>
                              <button 
                                onClick={() => toggleProduct(p)}
                                className="text-zinc-400 hover:text-red-500 transition-colors opacity-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(useCashback || useCredits) && (
                    <div className="pt-2 border-t border-zinc-100 space-y-1">
                      {useCashback && (
                        <div className="flex justify-between text-emerald-600 font-bold text-xs">
                          <span>Desconto Cashback:</span> 
                          <span>- R$ {Math.min(customerCashback, calculateTotalBeforeCashback()).toFixed(2)}</span>
                        </div>
                      )}
                      {useCredits && (
                        <div className="flex justify-between text-zinc-900 font-bold text-xs">
                          <span>Desconto Créditos:</span> 
                          <span>- R$ {Math.min(customerCredits, calculateTotalBeforeCredits()).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-zinc-100 mt-3">
                    <div className="flex justify-between items-center text-zinc-400 font-bold text-xs uppercase tracking-widest">
                      <span>Subtotal:</span> 
                      <span>R$ {calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {appliedCoupon && (
                      <div className="flex justify-between items-center text-emerald-600 font-black text-xs uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Tag size={12} /> Cupom ({appliedCoupon.code}):</span> 
                        <span>- R$ {calculateDiscount().toFixed(2)}</span>
                      </div>
                    )}
                    {calculateSubscriptionCoverage() > 0 && (
                      <div className="flex justify-between items-center text-amber-700 font-black text-xs uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Crown size={12} /> Coberto pelo plano:</span>
                        <span>- R$ {calculateSubscriptionCoverage().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-zinc-900 font-black text-lg uppercase tracking-tighter">
                        {calculateSubscriptionCoverage() > 0 && calculateTotal() > 0 ? "Diferença a pagar:" : "Total Final:"}
                      </span>
                      <span className="text-3xl font-black text-zinc-900">R$ {calculateTotal().toFixed(2)}</span>
                    </div>
                    {calculateSubscriptionCoverage() > 0 && calculateTotal() > 0 && (
                      <p className="text-[11px] text-amber-700 font-medium text-right">
                        Sua assinatura cobre parte do valor. Você paga apenas a diferença.
                      </p>
                    )}
                  </div>


                  
                  {cashbackEnabled && shop.cashback_enabled && (
                    <div className="bg-emerald-50 p-3 rounded-xl text-[11px] text-center mt-3 border border-emerald-100">
                      <span className="text-zinc-600 font-medium">Você receberá </span>
                      <span className="text-emerald-700 font-black">R$ {(calculateTotal() * (shop.cashback_percentage / 100)).toFixed(2)}</span>
                      <span className="text-zinc-600 font-medium"> de volta nesta reserva!</span>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  {bookingCart.length > 0 || selectedService ? (
                    <div className="space-y-4">
                      {(() => {
                        console.log('BOOKING CART', bookingCart);
                        console.log('PAYMENT METHOD', paymentMethod);
                        console.log('TOTAL FINAL', calculateTotal());
                        console.log('SHOW CONFIRM BUTTON', bookingCart.length > 0 || !!selectedService);
                        return null;
                      })()}
                      
                      {(!paymentMethod && calculateTotal() > 0) ? (
                        <>
                          {calculateSubscriptionCoverage() > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4 flex items-center gap-4">
                              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                <Crown size={22} className="text-amber-700" />
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Pagamento da diferença</p>
                                <p className="text-sm text-amber-900 font-medium leading-tight mt-0.5">
                                  Sua assinatura cobre <span className="font-black">R$ {calculateSubscriptionCoverage().toFixed(2)}</span>. Resta apenas <span className="font-black">R$ {calculateTotal().toFixed(2)}</span> a pagar.
                                </p>
                              </div>
                            </div>
                          )}
                        <div className="grid grid-cols-1 gap-4">
                          <Button 
                            className="flex items-center justify-between h-20 px-6 bg-black text-white hover:bg-zinc-800 border border-zinc-700 rounded-2xl font-semibold shadow-md transition-all duration-200 hover:shadow-lg group"
                            onClick={() => setPaymentMethod('barbershop')}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                                <Scissors size={24} className="text-white" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-white">Pagar na Barbearia</p>
                                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider opacity-80">Pague após o serviço</p>
                              </div>
                            </div>
                            <ChevronRight size={20} className="text-white/60 group-hover:text-white transition-colors" />
                          </Button>
                          <Button 
                            className="flex items-center justify-between h-20 px-6 bg-black text-white hover:bg-zinc-800 border border-zinc-700 rounded-2xl font-semibold shadow-md transition-all duration-200 hover:shadow-lg group"
                            onClick={() => setPaymentMethod('pix')}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                                <QrCode size={24} className="text-white" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-white">Pagar Agora (PIX)</p>
                                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider opacity-80">Confirmação instantânea</p>
                              </div>
                            </div>
                            <ChevronRight size={20} className="text-white/60 group-hover:text-white transition-colors" />
                          </Button>
                        </div>
                        </>
                      ) : (
                        <div className="space-y-4">
                          {paymentMethod === 'pix' && calculateTotal() > 0 && (
                            <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-6 space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
                              <div className="flex flex-col items-center gap-2">
                                <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-1">
                                  <QrCode size={32} className="text-blue-500" />
                                </div>
                                <p className="text-lg font-bold text-zinc-900 uppercase tracking-tight">Pagamento Instantâneo</p>
                                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Escaneie ou copie o código</p>
                              </div>
                              
                              {shop.pix_qr_code_url && (
                                <div className="flex justify-center group">
                                  <div className="relative p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm transition-transform group-hover:scale-105 duration-300">
                                    <img src={shop.pix_qr_code_url} className="h-44 w-44 object-contain" alt="PIX QR Code" />
                                  </div>
                                </div>
                              )}
                              
                              <div className="space-y-3">
                                <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200 text-sm font-mono break-all flex flex-col items-center gap-4 shadow-inner">
                                  <span className="text-center text-zinc-700 font-bold text-base leading-relaxed">{shop.pix_key || "Chave não cadastrada"}</span>
                                  {shop.pix_key && (
                                    <Button 
                                      variant="outline" 
                                      size="lg" 
                                      className="w-full h-12 bg-white text-black hover:bg-zinc-50 border border-zinc-200 rounded-xl font-medium transition-all duration-200"
                                      onClick={() => {
                                        navigator.clipboard.writeText(shop.pix_key);
                                        toast.success("Chave PIX copiada!");
                                      }}
                                    >
                                      <CheckCircle2 size={18} className="mr-2" /> Copiar Chave PIX
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {paymentMethod === 'barbershop' && (
                            <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                              <div className="flex flex-col items-center gap-2 mb-2">
                                <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                                  <Scissors size={24} className="text-blue-500" />
                                </div>
                                <p className="text-base font-bold text-zinc-900 uppercase">Pagar na Unidade</p>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center gap-4 text-left p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                                  <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                    <CheckCircle2 size={20} className="text-emerald-500" />
                                  </div>
                                  <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                                    Sua vaga será reservada imediatamente. O pagamento será feito diretamente na recepção.
                                  </p>
                                </div>
                                <div className="flex items-center gap-4 text-left p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                    <Clock size={20} className="text-blue-500" />
                                  </div>
                                  <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                                    Chegue com 5 minutos de antecedência para garantir seu horário.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {calculateTotal() === 0 && (
                            <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-6 text-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
                              <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 size={24} className="text-emerald-600" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-base font-bold text-emerald-700">Valor Total Coberto!</p>
                                <p className="text-sm text-zinc-500">O agendamento será quitado com seus créditos/descontos.</p>
                              </div>
                            </div>
                          )}

                          <div className="space-y-3">
                            <Button
                              disabled={(!paymentMethod && calculateTotal() > 0) || submitting}
                              onClick={handleFinalizeBooking}
                              className="w-full h-14 rounded-xl bg-black hover:bg-zinc-800 text-white font-semibold shadow-md transition-all"
                            >
                              {submitting ? (
                                <RefreshCcw className="animate-spin h-5 w-5 mr-2" />
                              ) : (
                                !paymentMethod && calculateTotal() > 0 ? "Escolha uma forma de pagamento" : (calculateTotal() > 0 && calculateSubscriptionCoverage() > 0 ? `Pagar diferença R$ ${calculateTotal().toFixed(2)}` : (calculateTotal() > 0 && paymentMethod === 'pix' ? "Confirmar e pagar" : "Confirmar agendamento"))
                              )}
                            </Button>
                            
                            {paymentMethod && !submitting && (
                              <Button 
                                variant="outline" 
                                className="w-full h-12 bg-white text-black hover:bg-zinc-50 border border-zinc-200 rounded-xl font-medium transition-all duration-200" 
                                onClick={() => setPaymentMethod(null)}
                              >
                                Alterar forma de pagamento
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Seu carrinho está vazio</p>
                      <Button 
                        variant="link" 
                        className="text-blue-600 font-black mt-2"
                        onClick={() => setBookingStep(2)}
                      >
                        Selecionar um serviço
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {bookingStep > 1 && (
            <DialogFooter className="flex justify-between items-center sm:justify-between px-0 pt-6 mt-6 border-t border-zinc-100 shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white text-black hover:bg-zinc-50 border border-zinc-200 rounded-xl font-medium transition-all duration-200"
                onClick={() => {
                  if (bookingStep === 5 && paymentMethod) {
                    setPaymentMethod(null);
                  }
                  setBookingStep(prev => prev - 1);
                }}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              {bookingStep < 5 && (
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                  Passo {bookingStep} de 5
                </div>
              )}
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>

      {/* Modal: Utilizações esgotadas */}
      <ExhaustedUsesModal
        open={exhaustedOpen}
        onOpenChange={setExhaustedOpen}
        planName={activeSubscription?.plan?.name || subUsage.plan_name}
        usedLabel={
          subUsage.has_limits
            ? `${subUsage.total_uses_consumed}/${subUsage.total_uses_allowed} utilizados`
            : undefined
        }
        renewalDate={subUsage.renewal_date}
        reason={exhaustedReason}
        serviceName={exhaustedServiceName}
        onChangePlan={() => {
          setExhaustedOpen(false);
          setTimeout(() => setChangePlanOpen(true), 120);
        }}
        onPayStandalone={() => {
          setExhaustedOpen(false);
          setBookingMode('standalone');
        }}
      />

      {activeSubscription?.id && activeSubscription?.plan_id && shop?.id && (
        <ChangePlanModal
          open={changePlanOpen}
          onOpenChange={setChangePlanOpen}
          tenantId={shop.id}
          subscriptionId={activeSubscription.id}
          currentPlanId={activeSubscription.plan_id}
        />
      )}


      {/* Floating Cart Button */}
      {selectedProducts.length > 0 && (
        <Button 
          style={{ backgroundColor: primaryColor }}
          className="fixed bottom-24 right-6 h-14 px-6 rounded-full shadow-lg z-50 animate-in fade-in zoom-in duration-300 gap-2 text-white"
          onClick={() => {
            setIsCartOpen(true);
          }}
        >
          <ShoppingBag size={20} />
          <span className="font-bold">Ver Carrinho ({selectedProducts.reduce((acc, p) => acc + (p.quantity || 1), 0)})</span>
          <span className="ml-2 pl-2 border-l border-white/20">R$ {calculateTotalBeforeCashback().toFixed(2)}</span>
        </Button>
      )}

      {/* Floating WhatsApp Button */}
      {shop.whatsapp_enabled && shop.whatsapp_number && (
        <a 
          href={`https://wa.me/${shop.whatsapp_number}`} 
          target="_blank" 
          rel="noreferrer"
          className="fixed bottom-6 right-6 h-14 w-14 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-green-600 transition-colors z-50"
        >
          <MessageSquare size={28} />
        </a>
      )}

      {/* Services for Barber Modal */}
      <Dialog open={isServicesModalOpen} onOpenChange={setIsServicesModalOpen}>
        <DialogContent className="sm:max-w-[425px] dark bg-card border-white/5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Serviços de {modalBarber?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {modalBarber && services
              .filter(s => modalBarber.barber_services?.some((bs: any) => bs.service_id === s.id))
              .map(service => (
                <div 
                  key={service.id} 
                  className="p-3 border rounded-lg flex justify-between items-center hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedService(service);
                    setSelectedBarber(modalBarber);
                    setIsServicesModalOpen(false);
                    setIsBookingOpen(true);
                    setBookingStep(3); // Go straight to date selection
                  }}
                >
                  <div>
                    <p className="font-bold">{service.name}</p>
                    <p className="text-xs text-muted-foreground">{service.duration_minutes} min</p>
                  </div>
                  <p className="font-bold" style={{ color: primaryColor }}>R$ {service.price.toFixed(2)}</p>
                </div>
              ))}
            {modalBarber && !modalBarber.barber_services?.length && (
              <p className="text-center text-muted-foreground py-4">Este profissional ainda não tem serviços vinculados.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Cancellation & Rating Access Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Agendamento</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="cancelToken">Código do Agendamento</Label>
              <Input 
                id="cancelToken" 
                placeholder="Insira o código recebido" 
                value={cancelTokenInput}
                onChange={(e) => setCancelTokenInput(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O cancelamento só pode ser realizado antes do horário marcado. A avaliação é liberada após a conclusão do serviço.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              onClick={handleCheckRatingEligibility}
            >
              Avaliar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelAppointment}
              disabled={cancelling}
            >
              {cancelling ? "Cancelando..." : "Cancelar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cart Summary Modal */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag size={20} style={{ color: primaryColor }} />
              Seu Carrinho
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedProducts.length > 0 ? (
              <>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                  {selectedProducts.map((p) => (
                    <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg bg-muted/30">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-bold text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">R$ {p.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border rounded-md bg-background">
                          <button 
                            onClick={() => updateQuantity(p.id, -1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm font-bold">{p.quantity || 1}</span>
                          <button 
                            onClick={() => updateQuantity(p.id, 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
                            disabled={(p.quantity || 1) >= p.stock_quantity}
                          >
                            +
                          </button>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeFromCart(p.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-bold">R$ {calculateTotalBeforeCashback().toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Deseja agendar um serviço também? Você poderá revisar tudo na finalização.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8 space-y-3">
                <ShoppingBag size={48} className="mx-auto text-muted-foreground/20" />
                <p className="text-muted-foreground">Seu carrinho está vazio.</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            {selectedProducts.length > 0 && (
              <Button 
                className="w-full" 
                style={{ backgroundColor: primaryColor }}
                onClick={() => {
                  setIsCartOpen(false);
                  setIsPixVisible(true);
                }}
              >
                Pagar Agora
              </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={() => setIsCartOpen(false)}>
              Continuar Comprando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating Modal */}
      <Dialog open={isRatingModalOpen} onOpenChange={setIsRatingModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Avaliar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Sua nota para o atendimento:</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className={cn(
                      "p-1 transition-transform active:scale-95",
                      ratingValue >= star ? "text-yellow-500" : "text-muted-foreground/30"
                    )}
                  >
                    <Star size={32} fill={ratingValue >= star ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="ratingComment">Comentário (Opcional)</Label>
              <textarea
                id="ratingComment"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Conte-nos o que achou do atendimento..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={handleSubmitRating} disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar Avaliação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIX Payment Modal */}
      <Dialog open={isPixVisible} onOpenChange={setIsPixVisible}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode size={20} className="text-[#D4AF37]" />
              Pagamento via PIX
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Total a pagar:</p>
              <p className="text-3xl font-bold text-black">
                R$ {calculateTotalBeforeCashback().toFixed(2)}
              </p>
            </div>

            {shop.pix_qr_code_url && (
              <div className="flex justify-center">
                <div className="p-3 border-2 border-muted rounded-xl bg-white">
                  <img 
                    src={shop.pix_qr_code_url} 
                    alt="PIX QR Code" 
                    className="h-48 w-48 object-contain"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Chave PIX</p>
              <div className="flex items-center justify-center gap-2">
                <p className="font-mono font-bold break-all">
                  {shop.pix_key || "Chave não cadastrada"}
                </p>
                {shop.pix_key && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(shop.pix_key);
                      toast.success("Chave PIX copiada!");
                    }}
                  >
                    <CheckCircle2 size={14} />
                  </Button>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Após realizar o pagamento, você pode prosseguir com o agendamento do seu horário.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button 
              className="w-full bg-black text-white hover:bg-black/90" 

              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const items = selectedProducts.map(p => ({
                    product_id: p.id,
                    name: p.name,
                    price: p.price,
                    quantity: p.quantity || 1
                  }));

                  // 1. Create sale record in product_sales for the "Faturamento" tab
                  const totalAmount = calculateTotalBeforeCashback();
                  
                  // Ensure customer exists and get ID
                  let saleCustomerId = customerId;
                  
                  if (!saleCustomerId && customerPhone) {
                    const normalized = typeof normalizePhone === "function" ? normalizePhone(customerPhone) : customerPhone;
                    
                    // 1. Try to find existing
                    console.log('TABLE:', 'customers');
                    console.log('ACTION:', 'select/insert (Standalone Sale)');
                    const { data: custData, error: checkError } = await supabase
                      .from("customers")
                      .select("id")
                      .eq("phone", normalized)
                      .eq("user_id", shop.id)
                      .maybeSingle();
                    
                    if (checkError) console.error('SUPABASE ERROR (check customer standalone):', checkError);

                    if (custData) {
                      saleCustomerId = custData.id;
                      console.log('DEBUG: Found existing customer for standalone sale', saleCustomerId);
                    } else if (customerName) {
                      // For standalone product sales, we might need a barber_id too if the RLS requires it
                      const defaultBarberId = selectedBarber?.id || barbers[0]?.id;
                      
                      if (!defaultBarberId) {
                        throw new Error("Não foi possível identificar um profissional para esta venda.");
                      }

                      // 2. Create new if not found
                      const customerPayload = {
                        user_id: shop.id,
                        barber_id: defaultBarberId,
                        name: customerName,
                        phone: normalized,
                        cashback_balance: 0,
                        loyalty_points: 0
                      };
                      console.log('PAYLOAD:', customerPayload);

                      const { data: newCust, error: createError } = await supabase
                        .from("customers")
                        .insert([customerPayload])
                        .select("id")
                        .single();
                        
                      if (createError) {
                        console.error('SUPABASE ERROR (insert customer standalone):', createError);
                        throw createError;
                      }
                      saleCustomerId = newCust.id;
                      console.log('DEBUG: New customer created for standalone sale', saleCustomerId);
                    }
                  }

                  if (!saleCustomerId) throw new Error("Identificação do cliente é obrigatória para vendas.");

                  const defaultBarberId = selectedBarber?.id || barbers[0]?.id;
                  const salePayload = {
                    user_id: shop.id,
                    barber_id: defaultBarberId,
                    customer_id: saleCustomerId,
                    total_amount: totalAmount,
                    status: 'completed' as any,
                    items: items as any
                  };
                  
                  console.log('TABLE:', 'product_sales');
                  console.log('ACTION:', 'insert');
                  console.log('PAYLOAD:', salePayload);

                  const { data: saleData, error: saleError } = await supabase.from("product_sales").insert([salePayload]).select().single();

                  if (saleError) {
                    console.error('SUPABASE ERROR (insert sale standalone):', saleError);
                    throw saleError;
                  }

                  // 2. Create finance transaction for the "Financeiro" tab
                  const transPayload = {
                    user_id: shop.id,
                    barber_id: defaultBarberId,
                    type: "income",
                    category: "Produtos",
                    amount: totalAmount,
                    description: `Venda de Produtos (Standalone) - Itens: ${items.map(i => `${i.name} (x${i.quantity})`).join(", ")}`,
                    date: new Date().toISOString().split('T')[0]
                  };
                  console.log('TABLE:', 'transactions');
                  console.log('ACTION:', 'insert');
                  console.log('PAYLOAD:', transPayload);

                  const { error: transError } = await supabase.from("transactions").insert([transPayload]);

                  if (transError) {
                    console.error('SUPABASE ERROR (insert transaction standalone):', transError);
                    throw transError;
                  }

                  // 3. Update stock for each product
                  for (const item of items) {
                    await (supabase as any).rpc('decrement_product_stock', { 
                      prod_id: item.product_id, 
                      amount: item.quantity 
                    });
                  }

                  toast.success("Pagamento confirmado! Estoque e faturamento atualizados.");

                  setIsPixVisible(false);
                  setSelectedProducts([]);
                  
                  // Redirect back to the shop's main page
                  window.location.href = `/${slug}`;
                } catch (error: any) {
                  console.error("Error processing sale:", error);
                  toast.error("Erro ao confirmar pagamento: " + error.message);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? "Processando..." : "Confirmar Pagamento"}
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl border-zinc-200 text-zinc-600 font-semibold"
              onClick={() => {
                setIsPixVisible(false);
                setIsBookingOpen(true);
                setBookingStep(2); // Retornando para step 2
              }}
            >
              Agendar Serviço
            </Button>
            <Button variant="ghost" className="w-full h-12 text-zinc-400 font-medium" onClick={() => setIsPixVisible(false)}>
              Voltar ao Carrinho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Cancellation & Rating Access Modal */}
      {!isEmbedded && <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Acessar Agendamento</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">Insira o código do seu agendamento para avaliar o serviço.</p>
            <div className="grid gap-2">
              <Label htmlFor="token">Código do Agendamento</Label>
              <Input 
                id="token" 
                placeholder="Ex: ABC-123" 
                value={cancelTokenInput} 
                onChange={(e) => setCancelTokenInput(e.target.value)} 
              />
            </div>
            <Button className="w-full" onClick={handleCheckRatingEligibility}>
              Acessar
            </Button>
          </div>
        </DialogContent>
      </Dialog>}
      {/* Product Detail Modal */}
      <Dialog open={!!selectedProductForModal} onOpenChange={(open) => !open && setSelectedProductProductForModal(null)}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden dark bg-[#0a0a0a] border-white/10 rounded-[3rem] shadow-2xl">
          <div className="grid md:grid-cols-2 h-full max-h-[85vh] overflow-y-auto">
            <div className="aspect-square relative bg-[#111] overflow-hidden">
               {selectedProductForModal?.image_url ? (
                  <img src={selectedProductForModal.image_url} alt={selectedProductForModal.name} className="w-full h-full object-cover" />
               ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-10">
                    <Package size={120} />
                  </div>
               )}
               {selectedProductForModal?.badge && (
                  <div className="absolute top-8 left-8 z-10">
                    <span className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-2xl" style={{ backgroundColor: primaryColor }}>
                      {selectedProductForModal.badge}
                    </span>
                  </div>
               )}
            </div>

            <div className="p-8 md:p-12 flex flex-col space-y-8 bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-primary" style={{ color: primaryColor }}>{selectedProductForModal?.category || 'Premium'}</p>
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-500" fill="currentColor" />
                    <span className="text-xs font-bold text-white">4.9</span>
                  </div>
                </div>
                <h3 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter leading-none text-white">{selectedProductForModal?.name}</h3>
                {selectedProductForModal?.brand && <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{selectedProductForModal.brand}</p>}
              </div>

              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-white">R$ {Number(selectedProductForModal?.price || 0).toFixed(2)}</span>
                  {selectedProductForModal?.promotional_price && (
                    <span className="text-lg text-slate-600 line-through font-bold">R$ {Number(selectedProductForModal.promotional_price).toFixed(2)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 w-fit">
                   <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                   <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Em estoque: {selectedProductForModal?.stock_quantity} unidades</p>
                </div>
              </div>

              <div className="space-y-6 flex-1">
                 <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descrição do Especialista</h5>
                    <p className="text-slate-400 text-sm leading-relaxed">
                       {selectedProductForModal?.description || "Este produto foi criteriosamente selecionado por nossos profissionais para oferecer o máximo em desempenho e estilo. Ideal para homens que não abrem mão da excelência no cuidado pessoal."}
                    </p>
                 </div>

                 <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                       <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Fixação</p>
                       <p className="text-xs font-bold text-white">Forte & Duradoura</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                       <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Brilho</p>
                       <p className="text-xs font-bold text-white">Matte Natural</p>
                    </div>
                 </div>
              </div>

              <div className="pt-8 border-t border-white/5 space-y-4">
                 <Button 
                    className="w-full h-16 rounded-2xl text-lg font-black uppercase tracking-tighter shadow-2xl hover:scale-[1.02] transition-all"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => {
                      if (selectedProductForModal) {
                        addToCart(selectedProductForModal);
                        setSelectedProductProductForModal(null);
                      }
                    }}
                 >
                    Adicionar ao Carrinho
                 </Button>
                 <Button 
                    variant="outline"
                    className="w-full h-14 rounded-2xl border-white/10 hover:bg-white/5 font-black uppercase tracking-widest text-xs gap-2"
                    onClick={() => {
                      const message = encodeURIComponent(`Olá! Gostaria de comprar o produto ${selectedProductForModal?.name} na ${shop.business_name}.`);
                      window.open(`https://wa.me/${shop.whatsapp_number}?text=${message}`, '_blank');
                    }}
                 >
                    <MessageSquare size={18} /> Comprar via WhatsApp
                 </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Premium Success Overlay */}
      <Dialog open={!!premiumSuccess} onOpenChange={(o) => { if (!o) { setPremiumSuccess(null); navigate({ to: `/${slug}/portal` as any, replace: true }); } }}>
        <DialogContent className="max-w-md bg-transparent border-none p-0 shadow-none">
          <DialogTitle className="sr-only">Agendamento Premium Confirmado</DialogTitle>
          {premiumSuccess && (
            <div className="relative rounded-3xl overflow-hidden border-2 border-[#D4AF37]/70 bg-gradient-to-br from-[#0a0a0a] via-[#1a1408] to-[#0a0a0a] p-6 shadow-[0_30px_80px_rgba(212,175,55,0.45)]">
              <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #D4AF37 1px, transparent 1px), radial-gradient(circle at 80% 80%, #D4AF37 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

              <div className="relative flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  className="h-20 w-20 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8a6d12] grid place-items-center mb-3 shadow-[0_10px_30px_rgba(212,175,55,0.5)]"
                >
                  <CheckCircle2 size={44} className="text-black" />
                </motion.div>

                <p className="text-[10px] uppercase tracking-[0.3em] text-[#D4AF37]/90 font-black">Agendamento Premium</p>
                <h3 className="text-2xl font-black uppercase tracking-tight text-white mt-1">Confirmado ✦</h3>
                <p className="text-[11px] text-gray-400 mt-1">Benefício do plano reservado com sucesso</p>
              </div>

              <div className="relative mt-5 space-y-2.5">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-black/40 border border-[#D4AF37]/20 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Crown size={14} className="text-[#D4AF37] shrink-0" />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Plano</span>
                  </div>
                  <span className="text-sm font-black text-white truncate">{premiumSuccess.plan}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-black/40 border border-white/5 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Scissors size={14} className="text-[#D4AF37] shrink-0" />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Serviço</span>
                  </div>
                  <span className="text-sm font-black text-white truncate">{premiumSuccess.service}</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-black/40 border border-white/5 p-3">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Data</p>
                    <p className="text-sm font-black text-white mt-1">
                      {(() => { try { return format(parseISO(premiumSuccess.date), "dd 'de' MMM", { locale: ptBR }); } catch { return premiumSuccess.date; } })()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-black/40 border border-white/5 p-3">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Horário</p>
                    <p className="text-sm font-black text-white mt-1">{premiumSuccess.time}</p>
                  </div>
                </div>
                {premiumSuccess.barber && (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-black/40 border border-white/5 p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserIcon size={14} className="text-[#D4AF37] shrink-0" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Profissional</span>
                    </div>
                    <span className="text-sm font-black text-white truncate">{premiumSuccess.barber}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-transparent border border-emerald-500/30 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Gift size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-300">Benefícios restantes</span>
                  </div>
                  <span className="text-base font-black text-emerald-400">
                    {premiumSuccess.remaining === null ? "Ilimitado" : premiumSuccess.remaining}
                  </span>
                </div>
                {premiumSuccess.nextRenewal && (
                  <p className="text-[10px] text-center text-gray-500 uppercase tracking-widest font-bold pt-1">
                    Próxima renovação: {format(parseISO(premiumSuccess.nextRenewal), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>

              <Button
                className="relative w-full h-12 mt-5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8941F] text-black font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg"
                onClick={() => { setPremiumSuccess(null); navigate({ to: `/${slug}/portal` as any, replace: true }); }}
              >
                Ir para o portal
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BackToTopButton />
    </div>
  );
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed right-5 md:right-6 z-[60] h-12 w-12 md:h-14 md:w-14 rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-[#050505] shadow-[0_12px_30px_rgba(245,197,66,0.42)] flex items-center justify-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(245,197,66,0.55)] ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
    >
      <ArrowUp size={20} strokeWidth={2.5} />
    </button>
  );
}
