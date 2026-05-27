import { createFileRoute, useNavigate, Outlet, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Scissors, Calendar, MapPin, Phone, MessageSquare, Clock, CheckCircle2, ChevronRight, ChevronLeft, ShoppingBag, Package, Gift, Trash2, Star, QrCode, User as UserIcon, RefreshCcw, CircleDollarSign, ArrowLeft, Plus, Minus, Tag, TicketPercent, X } from "lucide-react";
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
import { normalizePhone } from "@/utils/phone";
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
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  const isEmbedded = searchParams.get('embed') === 'true';
  const initialPhone = searchParams.get('phone') || "";
  const initialName = searchParams.get('name') || "";
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Debug logs to trace route issues
  useEffect(() => {
    console.log('SHOP PAGE DEBUG:', { slug, path: location.pathname, loading, shopId: shop?.id });
  }, [slug, location.pathname, loading, shop?.id]);
  const [scrolled, setScrolled] = useState(false);
  
  const isPortalRoute = location.pathname.endsWith('/portal');
  const isProfissionalRoute = location.pathname.endsWith('/profissional');

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
    const cats = ["Todos", ...new Set(products.map(p => p.category).filter(Boolean))];
    return cats;
  }, [products]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
          
          if (data.name && bookingStep === 1) {
            // Restore auto-advancing behavior if found
            setBookingStep(2);
          }
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
      // Restaurando para ir para o step 2 (seleção de serviço) automaticamente
      setBookingStep(2);
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
          trial_end
        `)
        .eq("slug", normalizedSlug)
        .maybeSingle();

      if (profileError || !currentShop) {
        console.error("Shop not found or error:", profileError);
        setLoading(false);
        return;
      }

      setShop(currentShop);

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
      setBarbers(barbersRes.data || []);
      setProducts(productsRes.data || []);
      
      // Atualizar o título da página dinamicamente
      if (typeof document !== 'undefined') {
        document.title = `${currentShop.business_name} | Barbearia Premium`;
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

      if (customerId || currentCustomer) {
        const name = customerName || currentCustomer?.name;
        if (name) {
          setCustomerName(name);
        }
        if (currentCustomer?.id) setCustomerId(currentCustomer.id);
        setBookingStep(2);
      } else {
        // Novo cliente
        if (!customerName || customerName.trim().length < 3) {
          toast.info("Por favor, informe seu nome completo.");
        } else {
          console.log('BOOKING DATA DEBUG: New customer proceeding', { customerName, customerPhone });
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
      if (!finalCustId) {
        console.log('DEBUG: Creating new customer', { name: customerName, phone: normalized });
        const { data: newCust, error: custError } = await supabase
          .from("customers")
          .insert([{
            user_id: shop.id,
            name: customerName,
            phone: normalized
          }])
          .select()
          .single();
        
        if (custError) throw custError;
        finalCustId = newCust.id;
        setCustomerId(finalCustId);
      } else {
        // Sync name if changed
        await supabase.from("customers").update({ name: customerName }).eq("id", finalCustId);
      }

      // Generate Group ID for multiple appointments
      const appointmentGroupId = crypto.randomUUID();
      const finalPaymentMethod = paymentMethod || (calculateTotal() === 0 ? (useCredits ? 'credits' : 'cashback') : 'barbershop');

      // 2. Create Appointments
      const appointmentPromises = finalCart.map(item => {
        const timeWithSeconds = item.start_time.length === 5 ? `${item.start_time}:00` : item.start_time;
        const startTime = parseISO(`${item.date}T${timeWithSeconds}`);
        const endTime = addMinutes(startTime, item.duration);

        return supabase.from("appointments").insert([{
          user_id: shop.id,
          tenant_id: shop.id,
          customer_id: finalCustId,
          service_id: item.service_id,
          barber_id: item.barber_id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          total_price: item.price,
          original_total: item.price,
          status: "scheduled",
          payment_status: (paymentMethod === 'pix' || calculateTotal() === 0) ? 'paid' : 'pending',
          payment_method: finalPaymentMethod,
          source: 'online',
          appointment_group_id: appointmentGroupId,
          items: [{
            id: item.service_id,
            name: item.service_name,
            type: 'service',
            price: item.price,
            quantity: 1
          }]
        }]).select().single();
      });

      const appointmentResults = await Promise.all(appointmentPromises);
      const createdAppointments = appointmentResults.map(res => {
        if (res.error) throw res.error;
        return res.data;
      });

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
      const queryClient = (window as any).queryClient;
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
      }

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

        // WhatsApp Confirmation per appointment
        if (shop.whatsapp_enabled) {
          const startTime = parseISO(appt.start_time);
          triggerWhatsAppMessage({
            userId: shop.id,
            eventType: 'appointment_confirmation',
            phone: normalized,
            placeholders: {
              cliente: customerName,
              horario: `${format(startTime, "HH:mm")} do dia ${format(startTime, "dd/MM")}`,
              barbeiro: barberName,
              valor: (appt.total_price || 0).toFixed(2),
              customer_id: finalCustId || ""
            },
            appointmentId: appt.id
          });
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

      // Reset and redirect
      setIsBookingOpen(false);
      setBookingCart([]);
      setSelectedProducts([]);
      setBookingStep(1);
      setAppliedCoupon(null);
      setUseCashback(false);
      setUseCredits(false);
      setPaymentMethod(null);
      
      setTimeout(() => {
        // Redirecionamento usando navigate do TanStack Router com substituição de histórico
        navigate({ to: `/${slug}/portal`, replace: true });
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

  const calculateTotal = () => {
    let total = calculateTotalBeforeCashback();
    if (useCashback) {
      total = Math.max(0, total - Math.min(customerCashback, total));
    }
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

      // Validations
      const now = new Date();
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

      {/* Main Content */}
      {(!isPortalRoute && !isProfissionalRoute) ? (
        <>
          {/* Header */}
          {!isEmbedded && (
            <header className={cn(
              "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-4",
              scrolled ? "py-2" : "py-6"
            )}>
              <motion.div 
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={cn(
                  "mx-auto max-w-5xl rounded-full flex items-center justify-between gap-4 transition-all duration-500 border border-white/10",
                  scrolled ? "bg-black/60 backdrop-blur-xl px-6 h-14 shadow-2xl" : "bg-transparent px-2 h-16 border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt={shop.business_name} className="h-9 w-9 object-contain rounded-lg" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                      <Scissors className="h-5 w-5 text-[#D4AF37]" />
                    </div>
                  )}
                  <h1 className="font-bold text-base sm:text-lg tracking-tight truncate">{shop.business_name}</h1>
                </div>

                <nav className="hidden md:flex items-center gap-6 text-sm font-black uppercase tracking-widest text-white/70">
                  <a href="#inicio" className="hover:text-[#D4AF37] transition-colors cursor-pointer">Início</a>
                  <a href="#servicos" className="hover:text-[#D4AF37] transition-colors cursor-pointer">Serviços</a>
                  <a href="#produtos" className="hover:text-[#D4AF37] transition-colors cursor-pointer">Produtos</a>
                  <a href="#profissionais" className="hover:text-[#D4AF37] transition-colors cursor-pointer">Profissionais</a>
                  <a href="#contato" className="hover:text-[#D4AF37] transition-colors cursor-pointer">Contato</a>
                </nav>

                <Button 
                  className="bg-black text-white border border-[#D4AF37] shadow-lg hover:scale-105 hover:bg-[#D4AF37] hover:text-black transition-all h-10 px-6 rounded-full text-sm font-bold" 
                  onClick={handleBookingAction}
                >
                  {shop.scheduling_mode === 'manual' ? 'WhatsApp' : 'Agendar'}
                </Button>
              </motion.div>
            </header>
          )}


      <main className={cn("space-y-0", isEmbedded && "py-0")}>
        {/* Hero Section */}
        <section id="inicio" className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden">
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
              className="space-y-4"
            >
              <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase italic leading-none">
                Seu estilo <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40" style={{ WebkitTextStroke: `1px #D4AF37` }}>começa aqui.</span>
              </h2>
              <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-medium">
                Cortes premium, barbeiros especialistas e agendamento online em segundos.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button 
                size="lg" 
                className="h-14 px-10 text-lg font-black bg-black text-white border-2 border-[#D4AF37] rounded-full shadow-2xl hover:scale-105 hover:bg-[#D4AF37] hover:text-black transition-all w-full sm:w-auto uppercase tracking-tighter"
                onClick={handleBookingAction}
              >
                Agendar Agora
              </Button>
              <Button 
                variant="outline"
                size="lg" 
                className="h-14 px-10 text-lg font-bold rounded-full border-white/20 hover:bg-white/10 transition-all w-full sm:w-auto backdrop-blur-md"
                onClick={() => document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Conhecer Serviços
              </Button>
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
                  transition={{ delay: idx * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="group relative overflow-hidden border-gray-100 bg-white hover:bg-gray-50 transition-all duration-500 rounded-[2rem] h-full shadow-lg">
                    <div className="p-8 space-y-6">
                      <div className="flex justify-between items-start">
                        <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                          <Scissors className="h-6 w-6 text-gray-400 group-hover:text-[#D4AF37] transition-colors" />
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black tracking-tighter text-black">R$ {service.price.toFixed(2)}</p>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{service.duration_minutes} MIN</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-2xl font-black uppercase tracking-tight text-black group-hover:translate-x-1 transition-transform duration-500">{service.name}</h4>
                        <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed">
                          Cuidado especializado com produtos de alta qualidade para um resultado impecável.
                        </p>
                      </div>

                      <Button 
                        className="w-full h-12 rounded-xl font-bold transition-all bg-black text-white hover:bg-black/90 group-hover:shadow-xl hover:scale-105"
                        onClick={() => handleSelectService(service)}
                      >
                        Agendar este serviço
                      </Button>
                    </div>
                    {/* Decorative element */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: `${primaryColor}10` }} />
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Products Section */}
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
            <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? "default" : "outline"}
                  className={cn(
                    "rounded-full px-6 h-10 font-bold text-[10px] uppercase tracking-widest transition-all",
                    activeCategory === cat ? "shadow-lg scale-105" : "border-white/10 hover:bg-white/5 text-slate-500"
                  )}
                  style={activeCategory === cat ? { backgroundColor: "#D4AF37" } : {}}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
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
                  <Card className="group bg-zinc-950 border-zinc-800 rounded-[2rem] overflow-hidden hover:border-primary/50 hover:-translate-y-2 transition-all duration-500 flex flex-col h-full shadow-2xl hover:shadow-primary/10">
                    <div className="aspect-square relative overflow-hidden bg-zinc-900">
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
                      className="p-7 flex flex-col flex-1 space-y-4 cursor-pointer"
                      onClick={() => setSelectedProductProductForModal(product)}
                    >
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{product.category || 'Cuidados'}</p>
                        <h4 className="text-xl font-black uppercase tracking-tight leading-tight text-white group-hover:text-primary transition-colors" style={{ '--primary': primaryColor } as any}>{product.name}</h4>
                        {product.brand && <p className="text-xs font-bold text-zinc-400">{product.brand}</p>}
                      </div>

                      <p className="text-zinc-400 text-sm line-clamp-2 leading-relaxed flex-1 font-medium">
                        {product.short_description || product.description || "Produto selecionado com rigor para garantir resultados superiores."}
                      </p>

                      <div className="pt-4 border-t border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-2xl font-black text-white" style={{ color: primaryColor }}>R$ {Number(product.price).toFixed(2)}</span>
                            {product.promotional_price && (
                              <span className="text-xs text-slate-500 line-through font-bold">R$ {Number(product.promotional_price).toFixed(2)}</span>
                            )}
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Disponível</p>
                             <p className="text-xs font-bold text-slate-400">{product.stock_quantity} unidades</p>
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button 
                            className="w-full h-14 rounded-2xl font-black uppercase tracking-tighter transition-all bg-white text-black hover:bg-white/90 shadow-xl hover:scale-[1.02] active:scale-[0.98] border border-white/10"
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
          </div>
        </section>

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
                        <span className="text-sm font-bold text-white">{barber.average_rating || "5.0"}</span>
                        <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest ml-1">({barber.total_ratings || 0} reviews)</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Portal CTA Section */}
        <section className="py-24 bg-[#0a0a0a] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[120px] rounded-full pointer-events-none" style={{ backgroundColor: `${primaryColor}05` }} />
          
          <div className="max-w-4xl mx-auto px-4 relative z-10">
            <div className="glass p-12 md:p-20 rounded-[4rem] text-center space-y-10 border border-white/10 shadow-2xl">
              <div className="space-y-4">
                <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Pronto para elevar seu visual?</h3>
                <p className="text-slate-400 text-lg md:text-xl max-w-xl mx-auto font-medium leading-relaxed">
                  Agende seu horário agora e experimente o padrão de excelência que você merece.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Button 
                  size="lg"
                  className="h-16 px-12 rounded-full shadow-2xl hover:scale-105 transition-all gap-3 text-lg font-black uppercase tracking-tighter w-full sm:w-auto"
                  style={{ backgroundColor: primaryColor }}
                  onClick={handleBookingAction}
                >
                  Agendar meu horário
                </Button>
                <Button 
                  variant="link" 
                  size="lg" 
                  className="text-white hover:text-primary transition-colors font-bold text-lg underline-offset-8" 
                  asChild
                >
                  <a href={`/${slug}/portal`}>Acessar meu portal</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer id="contato" className="py-20 bg-[#050505] border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                   {shop.logo_url ? (
                    <img src={shop.logo_url} alt={shop.business_name} className="h-10 w-10 object-contain rounded-lg" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                      <Scissors className="h-6 w-6 text-[#D4AF37]" />
                    </div>
                  )}
                  <h4 className="font-bold text-xl tracking-tight">{shop.business_name}</h4>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                  A barbearia que redefine o conceito de estilo e cuidado masculino. Tradição e modernidade em um só lugar.
                </p>
                <div className="flex gap-4">
                  {shop.whatsapp_number && (
                    <a href={`https://wa.me/${shop.whatsapp_number}`} className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-all group" style={{ '--primary': primaryColor } as any}>
                      <MessageSquare size={18} className="text-slate-400 group-hover:text-white" />
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <h5 className="font-black uppercase tracking-widest text-xs text-[#D4AF37]">Localização</h5>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-slate-500 shrink-0" />
                    <p className="text-slate-400 text-sm leading-relaxed">{shop.address || "Endereço não informado"}</p>
                  </div>
                  <Button variant="link" className="text-xs p-0 h-auto text-[#D4AF37]" asChild>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address || shop.business_name)}`} target="_blank">Ver no Google Maps</a>
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                <h5 className="font-black uppercase tracking-widest text-xs text-[#D4AF37]">Links Rápidos</h5>
                <nav className="flex flex-col gap-3 text-sm font-medium text-slate-500">
                  <a href="#inicio" className="hover:text-white transition-colors">Início</a>
                  <a href="#servicos" className="hover:text-white transition-colors">Serviços</a>
                  <a href="#profissionais" className="hover:text-white transition-colors">Profissionais</a>
                  <a href={`/${slug}/portal`} className="hover:text-white transition-colors">Portal do Cliente</a>
                </nav>
              </div>

              <div className="space-y-6">
                <h5 className="font-black uppercase tracking-widest text-xs text-[#D4AF37]">Funcionamento</h5>
                <div className="space-y-2 text-sm text-slate-500 font-medium">
                  <p className="flex justify-between"><span>Seg - Sex:</span> <span className="text-white">09:00 - 20:00</span></p>
                  <p className="flex justify-between"><span>Sábado:</span> <span className="text-white">08:00 - 18:00</span></p>
                  <p className="flex justify-between"><span>Domingo:</span> <span className="text-white">Fechado</span></p>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 text-center flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-600">© 2026 {shop?.business_name} - Premium Experience</p>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-800">Powered by BarberSaaS Elite</p>
            </div>
          </div>
        </footer>

        {/* Mobile Bottom CTA */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 z-40">
          <Button 
            className="w-full h-14 rounded-2xl shadow-2xl bg-black text-white border-2 border-[#D4AF37] font-black uppercase tracking-tighter text-lg scale-100 active:scale-95 transition-all"
            onClick={handleBookingAction}
          >
            {shop.scheduling_mode === 'manual' ? 'Agendar WhatsApp' : 'Agendar Agora'}
          </Button>
        </div>
      </main>
    </>
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

        <DialogContent className={cn("sm:max-w-[480px] p-0 overflow-hidden bg-white border-2 border-[#D4AF37] h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl", isEmbedded && "w-full max-w-full m-0 h-full rounded-none border-none")}>
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar flex flex-col bg-gradient-to-b from-white/[0.02] to-transparent">
          {!isEmbedded && (
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

          <div className="flex-1 pr-1">
            {bookingStep === 1 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6 py-4"
              >
                <div className="space-y-2">
                  <h4 className="text-2xl font-bold text-black tracking-tight">Olá! 👋</h4>
                  <p className="text-zinc-600 text-sm font-medium">
                    Informe seu WhatsApp para começarmos seu agendamento.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-5 transition-all duration-300">
                    <div className="flex justify-between items-center mb-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Seu WhatsApp</Label>
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
                        placeholder="(00) 00000-0000"
                        className="relative z-10 w-full"
                        inputClassName="!w-full !h-14 !bg-white !border-zinc-200 !text-xl !font-medium !text-black !placeholder:text-zinc-400 focus:!outline-none !pl-4 !rounded-xl"
                        countrySelectorStyleProps={{
                          buttonClassName: "!h-14 !bg-white !border-zinc-200 !px-4 !rounded-l-xl hover:!bg-zinc-50 transition-colors",
                        }}
                      />
                      <style>{`
                        .international-phone-portal .react-international-phone-input-container {
                          width: 100%;
                          border: none;
                          background: transparent;
                        }
                        .international-phone-portal .react-international-phone-input {
                          width: 100% !important;
                          border: 1px solid #e4e4e7 !important;
                          border-radius: 0.75rem !important;
                        }
                        .international-phone-portal .react-international-phone-country-selector-button {
                          border: 1px solid #e4e4e7 !important;
                          border-right: none !important;
                          border-radius: 0.75rem 0 0 0.75rem !important;
                        }
                      `}</style>
                    </div>

                    <AnimatePresence mode="wait">
                      {normalizePhone(customerPhone).length >= 10 && !isSearchingCustomer && (
                        <motion.div 
                          key={customerId ? "found" : "new"}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-2"
                        >
                          {customerId ? (
                            <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-5 transition-all duration-300 flex items-center gap-4 animate-in fade-in slide-in-from-top-1">
                              <div className="h-12 w-12 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="text-sky-600" size={24} />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-zinc-900 tracking-tight leading-tight">
                                  Olá, {customerName.split(' ')[0]}! 👋
                                </h3>
                                <p className="text-xs text-zinc-500 font-medium">Que bom ter você de volta!</p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-5 transition-all duration-300 space-y-3 animate-in fade-in slide-in-from-top-1">
                              <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block ml-1">Primeira vez por aqui? Qual o seu nome?</Label>
                              <Input 
                                placeholder="Digite seu nome completo" 
                                value={customerName} 
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="bg-white text-black border border-zinc-200 placeholder:text-zinc-500 rounded-xl h-12 text-base font-medium focus-visible:ring-sky-600/50"
                              />
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <Button 
                    className="w-full h-14 bg-black text-white hover:bg-zinc-800 rounded-xl font-semibold shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                    onClick={handlePhoneCheck}
                    disabled={!customerPhone || submitting || isSearchingCustomer || (normalizePhone(customerPhone).length >= 10 && !customerId && (!customerName || customerName.trim().length < 3))}
                  >
                    {submitting ? "Verificando..." : "Continuar"}
                  </Button>
                </div>

                <p className="text-[10px] text-center text-zinc-400 font-bold uppercase tracking-widest pt-2">
                  Ambiente Seguro
                </p>
              </motion.div>
            )}

            {bookingStep === 2 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* O campo de nome agora é exibido no Step 1 se o cliente não for encontrado */}
                
                <div className="space-y-4">
                  <h5 className="text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37]">Selecione o Serviço</h5>
                  <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {services.map(s => (
                      <motion.div 
                        key={s.id} 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 p-4 transition-all duration-300 hover:shadow-lg hover:border-zinc-300 cursor-pointer flex justify-between items-center group relative overflow-hidden",
                          selectedService?.id === s.id ? "border-sky-600 ring-2 ring-sky-600/20" : ""
                        )}
                        onClick={() => {
                          if (!isEmbedded && (!customerName || customerName.length < 3)) {
                            toast.error("Por favor, informe seu nome primeiro.");
                            return;
                          }
                          setSelectedService(s);
                          setBookingStep(3);
                        }}
                      >
                        <div className="relative z-10">
                          <p className={cn("font-black uppercase tracking-tight text-lg", selectedService?.id === s.id ? "text-sky-700" : "text-black")}>{s.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <Clock size={12} className={selectedService?.id === s.id ? "text-sky-600" : "text-gray-400"} />
                             <p className={cn("text-[10px] font-black uppercase tracking-widest", selectedService?.id === s.id ? "text-sky-600" : "text-gray-400")}>{s.duration_minutes} min</p>
                          </div>
                        </div>
                        <p className={cn("font-black text-xl relative z-10", selectedService?.id === s.id ? "text-sky-600" : "text-black")}>R$ {s.price.toFixed(2)}</p>
                      </motion.div>
                    ))}
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
                  {shop.cashback_enabled && customerCashback > 0 && (
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
                      {bookingCart.map((item) => (
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
                            <span className="text-zinc-900 font-bold">R$ {(item.price || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <span className="flex items-center gap-1.5"><UserIcon size={10} /> {item.barber_name}</span>
                            <span>{format(parseISO(item.date), "dd/MM/yyyy")} às {item.start_time}</span>
                          </div>
                        </div>
                      ))}

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
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-zinc-900 font-black text-lg uppercase tracking-tighter">Total Final:</span> 
                      <span className="text-3xl font-black text-zinc-900">R$ {calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>


                  
                  {shop.cashback_enabled && (
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
                              {submitting ? "Confirmando..." : (!paymentMethod && calculateTotal() > 0 ? "Escolha uma forma de pagamento" : (calculateTotal() > 0 && paymentMethod === 'pix' ? "Confirmar e pagar" : "Confirmar agendamento"))}
                            </Button>
                            
                            {paymentMethod && (
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
                className="bg-white text-primary hover:bg-primary/5 border border-primary/30 rounded-xl font-medium transition-all duration-200"
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
                    const { data: custData } = await supabase
                      .from("customers")
                      .select("id")
                      .eq("phone", normalized)
                      .eq("user_id", shop.id)
                      .maybeSingle();
                      
                    if (custData) {
                      saleCustomerId = custData.id;
                    } else if (customerName) {
                      // For standalone product sales, we might need a barber_id too if the RLS requires it
                      // In the shop page, we might not have a selectedBarber if it's just a direct purchase
                      // but usually products are sold in the context of a barber visit in this app's flow.
                      // If selectedBarber is missing, we pick the first one or the "geral" one if exists.
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
                      console.log('INSERT CUSTOMER DATA (Standalone)', customerPayload);

                      const { data: newCust, error: createError } = await supabase
                        .from("customers")
                        .insert([customerPayload])
                        .select("id")
                        .single();
                        
                      if (createError) throw createError;
                      saleCustomerId = newCust.id;
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
                  console.log('INSERT PRODUCT SALE DATA (Standalone)', salePayload);

                  const { data: saleData, error: saleError } = await supabase.from("product_sales").insert([salePayload]).select().single();

                  if (saleError) throw saleError;

                  // 2. Create finance transaction for the "Financeiro" tab
                  const { error: transError } = await supabase.from("transactions").insert([{
                    user_id: shop.id,
                    barber_id: defaultBarberId,
                    type: "income",
                    category: "Produtos",
                    amount: totalAmount,
                    description: `Venda de Produtos (Standalone) - Itens: ${items.map(i => `${i.name} (x${i.quantity})`).join(", ")}`,
                    date: new Date().toISOString().split('T')[0]
                  }]);

                  if (transError) throw transError;

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
    </div>
  );
}
