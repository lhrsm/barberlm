import { createFileRoute, useNavigate, Outlet, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Scissors, Calendar, MapPin, Phone, MessageSquare, Clock, CheckCircle2, ChevronRight, ChevronLeft, ShoppingBag, Package, Gift, Trash2, Star, QrCode, User as UserIcon, RefreshCcw, CircleDollarSign, ArrowLeft, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, addMinutes, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { triggerWhatsAppMessage } from "@/utils/whatsapp";

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
  const searchParams = new URLSearchParams(window.location.search);
  const isEmbedded = searchParams.get('embed') === 'true';
  const initialPhone = searchParams.get('phone') || "";
  const initialName = searchParams.get('name') || "";
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Booking state
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

  const categories = useMemo(() => {
    const cats = ["Todos", ...new Set(products.map(p => p.category).filter(Boolean))];
    return cats;
  }, [products]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
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

  useEffect(() => {
    if (slug) {
      fetchShopData(slug);
    }
  }, [slug]);

  useEffect(() => {
    if (isEmbedded && initialPhone) {
      setCustomerPhone(initialPhone);
      if (initialName) setCustomerName(initialName);
      
      // Auto trigger phone check if embedded with phone
      const timer = setTimeout(() => {
        handlePhoneCheckWithParams(initialPhone);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isEmbedded, initialPhone, initialName, shop?.id]);

  const handlePhoneCheckWithParams = async (phone: string) => {
    if (!phone || phone.length < 8 || !shop?.id) return;
    setSubmitting(true);
    try {
      const customer = await checkCustomerCashback(phone);
      setBookingStep(2);
    } catch (error) {
      console.error("Error checking phone:", error);
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
      fetchAvailableTimes(selectedBarber.id, selectedDate);
    }
  }, [bookingStep, selectedBarber, selectedDate]);

  const fetchDayData = async (date: string) => {
    if (!shop?.id) return;
    setLoadingDayData(true);
    try {
      const startOfDay = `${date}T00:00:00Z`;
      const endOfDay = `${date}T23:59:59Z`;
      
      const { data } = await supabase
        .from("appointments")
        .select("barber_id, start_time, end_time")
        .eq("user_id", shop.id)
        .eq("status", "scheduled")
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay);
        
      setDayAppointments(data || []);
    } catch (error) {
      console.error("Error fetching day data:", error);
    } finally {
      setLoadingDayData(false);
    }
  };

  const isBarberAvailableOnDate = (barber: any, date: string, service: any, appointments: any[]) => {
    if (!service || !barber) return false;
    
    const performsService = barber.barber_services?.some((bs: any) => bs.service_id === service.id);
    if (!performsService) return false;

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

    if (!workingHours || !workingHours.enabled) return false;

    const barberAppointments = appointments?.filter(a => a.barber_id === barber.id) || [];
    const [startHour, startMin] = workingHours.start.split(':').map(Number);
    const [endHour, endMin] = workingHours.end.split(':').map(Number);
    const interval = 30;

    for (let hour = startHour; hour <= endHour; hour++) {
      for (let min = (hour === startHour ? startMin : 0); min < 60; min += interval) {
        if (hour === endHour && min >= endMin) break;
        const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const checkTime = parseISO(`${date}T${timeStr}:00`);
        
        if (isSameDay(checkTime, new Date()) && checkTime < new Date()) continue;

        const isBusy = barberAppointments.some(app => {
          const appStart = parseISO(app.start_time);
          const appEnd = parseISO(app.end_time);
          return checkTime >= appStart && checkTime < appEnd;
        });

        if (!isBusy) return true;
      }
    }
    return false;
  };

  async function fetchShopData(targetSlug: string) {
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

  const handleBookingAction = () => {
    if (shop?.scheduling_mode === 'manual') {
      const message = encodeURIComponent(`Olá! Gostaria de agendar um horário na ${shop.business_name}.`);
      window.open(`https://wa.me/${shop.whatsapp_number}?text=${message}`, '_blank');
    } else {
      setIsBookingOpen(true);
      setBookingStep(1);
    }
  };

  const handleSelectService = (service: any) => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isPortalRoute = location.pathname.endsWith('/portal');
  const isProfissionalRoute = location.pathname.endsWith('/profissional');

  if (isPortalRoute || isProfissionalRoute) {
    return <Outlet />;
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground mb-4">Barbearia não encontrada.</p>
        <Button asChild>
          <a href="/">Voltar para o início</a>
        </Button>
      </div>
    );
  }


  const checkConflict = async (barberId: string, date: string, time: string, serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return false;
    
    const startTime = parseISO(`${date}T${time}:00`);
    const endTime = addMinutes(startTime, service.duration_minutes || 30);

    const { data, error } = await supabase
      .from("appointments")
      .select("id")
      .eq("barber_id", barberId)
      .eq("status", "scheduled")
      .or(`and(start_time.lte.${startTime.toISOString()},end_time.gt.${startTime.toISOString()}),and(start_time.lt.${endTime.toISOString()},end_time.gte.${endTime.toISOString()}),and(start_time.gte.${startTime.toISOString()},end_time.lte.${endTime.toISOString()})`)
      .limit(1);

    if (error) {
      console.error("Erro ao verificar conflitos:", error);
      return false;
    }

    return data && data.length > 0;
  };

  const fetchAvailableTimes = async (barberId: string, date: string) => {
    setFetchingTimes(true);
    try {
      const barber = barbers.find(b => b.id === barberId);
      if (!barber) return;

      const dateObj = parseISO(date);
      const dayName = format(dateObj, "eeee", { locale: ptBR }).toLowerCase();
      
      // Map Portuguese day name to English key used in DB
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
        setAvailableTimes([]);
        return;
      }

      const startOfDayTime = `${date}T00:00:00Z`;
      const endOfDayTime = `${date}T23:59:59Z`;

      const { data: appointments, error } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("barber_id", barberId)
        .eq("status", "scheduled")
        .gte("start_time", startOfDayTime)
        .lte("start_time", endOfDayTime);

      if (error) throw error;

      const times = [];
      const [startHour, startMin] = workingHours.start.split(':').map(Number);
      const [endHour, endMin] = workingHours.end.split(':').map(Number);
      const interval = 30;

      for (let hour = startHour; hour <= endHour; hour++) {
        for (let min = (hour === startHour ? startMin : 0); min < 60; min += interval) {
          if (hour === endHour && min >= endMin) break;
          
          const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          const checkTime = parseISO(`${date}T${timeStr}:00`);
          
          // Don't show past times for today
          if (isSameDay(checkTime, new Date()) && checkTime < new Date()) {
            continue;
          }

          const isBusy = appointments?.some(app => {
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
      toast.error("Erro ao carregar horários disponíveis.");
    } finally {
      setFetchingTimes(false);
    }
  };


  const handleFinalizeBooking = async () => {
    if (!customerName || !customerPhone) {
      toast.error("Por favor, preencha seu nome e telefone.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create or get customer
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id, cashback_balance, credits")
        .eq("phone", customerPhone)
        .eq("user_id", shop.id)
        .maybeSingle();

      let customerId;
      if (customerData) {
        customerId = customerData.id;
        setCustomerCashback(Number(customerData.cashback_balance || 0));
        setCustomerCredits(Number(customerData.credits || 0));
      } else {
        const { data: newCustomer, error: createError } = await supabase
          .from("customers")
          .insert({
            user_id: shop.id,
            name: customerName,
            phone: customerPhone
          })
          .select("id")
          .maybeSingle();
        
        if (createError) throw createError;
        if (!newCustomer) throw new Error("Falha ao criar cliente");
        customerId = newCustomer.id;
        setCustomerCashback(0);
      }

      // Automatically create or update client_auth session for the portal
      const sessionData = {
        phone: customerPhone,
        customer_id: customerId,
        name: customerName
      };
      localStorage.setItem(`client_portal_session_${slug}`, JSON.stringify(sessionData));

      // Ensure client_auth record exists
      await supabase
        .from("client_auth")
        .upsert({
          phone: customerPhone,
          customer_id: customerId
        }, { onConflict: 'phone' });


      // 1.5 Check for conflict again to be sure
      const hasConflict = await checkConflict(selectedBarber.id, selectedDate, selectedTime, selectedService.id);
      if (hasConflict) {
        toast.error("Este horário acabou de ser preenchido. Por favor, escolha outro.");
        setBookingStep(3);
        fetchAvailableTimes(selectedBarber.id, selectedDate);
        setSubmitting(false);
        return;
      }

      // 2. Create appointment
      const startTime = parseISO(`${selectedDate}T${selectedTime}:00`);
      const endTime = addMinutes(startTime, selectedService.duration_minutes || 30);

      const { error: appError, data: appointment } = await supabase
        .from("appointments")
        .insert({
          user_id: shop.id,
          customer_id: customerId,
          service_id: selectedService.id,
          barber_id: selectedBarber.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          total_price: selectedService.price + selectedProducts.reduce((acc, p) => acc + (p.price * (p.quantity || 1)), 0),
          original_total: selectedService.price + selectedProducts.reduce((acc, p) => acc + (p.price * (p.quantity || 1)), 0),
          credit_used: useCredits ? Math.min(customerCredits, calculateTotalBeforeCredits()) : 0,
          cashback_used: useCashback ? Math.min(customerCashback, calculateTotalBeforeCashback()) : 0,
          pix_amount: paymentMethod === 'pix' ? calculateTotal() : 0,
          barbershop_amount: paymentMethod === 'barbershop' ? calculateTotal() : 0,
          final_amount: calculateTotal(),
          status: "scheduled",
          payment_method: paymentMethod || (calculateTotal() === 0 ? (useCredits ? 'credits' : 'cashback') : 'barbershop'),
          payment_status: (paymentMethod === 'pix' || calculateTotal() === 0) ? 'paid' : 'pending',
          notes: useCashback ? 
            `Pagamento: Cashback (R$ ${Math.min(customerCashback, calculateTotalBeforeCashback()).toFixed(2)})` : 
            useCredits ? `Pagamento: Créditos (R$ ${Math.min(customerCredits, calculateTotalBeforeCredits()).toFixed(2)})` : null,
          items: [
            { id: selectedService.id, name: selectedService.name, type: 'service', price: selectedService.price, quantity: 1 },
            ...selectedProducts.map(p => ({ id: p.id, name: p.name, type: 'product', price: p.price, quantity: p.quantity || 1 }))
          ]
        })
        .select()
        .single();

      if (appError) throw appError;

      // Realtime Invalidation
      const queryClient = (window as any).queryClient;
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["professional-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["professional-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      }

      // 2.5 Create notifications
      const notificationMessage = `Novo agendamento: ${selectedService.name} para ${customerName} em ${format(startTime, "HH:mm")} do dia ${format(startTime, "dd/MM")}`;
      
      // Admin notification
      await supabase.from("notifications").insert({
        user_id: shop.id,
        title: "Novo Agendamento",
        message: notificationMessage,
        type: "appointment",
        link: "/calendar"
      });

      // Barber notification
      await supabase.from("notifications").insert({
        user_id: shop.id,
        barber_id: selectedBarber.id,
        title: "Novo Agendamento para Você",
        message: notificationMessage,
        type: "appointment",
        link: `/${slug}/profissional`
      });

      // Send WhatsApp Confirmation
      if (shop.whatsapp_enabled) {
        triggerWhatsAppMessage({
          userId: shop.id,
          eventType: 'appointment_confirmation',
          phone: customerPhone,
          placeholders: {
            cliente: customerName,
            horario: `${format(startTime, "HH:mm")} do dia ${format(startTime, "dd/MM")}`,
            barbeiro: selectedBarber.name,
            valor: (selectedService.price + selectedProducts.reduce((acc, p) => acc + (p.price * (p.quantity || 1)), 0)).toFixed(2),
            customer_id: customerId
          },
          appointmentId: appointment.id
        });
      }

      // 3. Create transaction for the appointment (remaining amount - new revenue)
      if (paymentMethod === 'pix' || paymentMethod === 'barbershop' || calculateTotal() === 0) {
        const finalPaymentMethod = paymentMethod === 'pix' ? 'PIX' : (paymentMethod === 'barbershop' ? 'BARBEARIA' : 'CRÉDITOS/CASHBACK');
        const remainingAmount = calculateTotal();
        
        // Registrar transação para constar no operacional (mesmo se for 0 em dinheiro novo)
        await supabase.from("transactions").insert({
          user_id: shop.id,
          barber_id: selectedBarber.id,
          appointment_id: appointment.id,
          type: "income",
          category: "Serviço",
          amount: remainingAmount,
          description: `Agendamento (${finalPaymentMethod}): ${selectedService.name} - Cliente: ${customerName}${useCredits ? ` (Abatimento Créditos: R$ ${Math.min(customerCredits, calculateTotalBeforeCredits()).toFixed(2)})` : ""}`,
          date: new Date().toISOString().split('T')[0]
        });

        // 4. Products faturamento (Products table tracks total sales regardless of credit use for stock/performance)
        for (const item of selectedProducts) {
          await supabase.from("product_sales").insert({
            user_id: shop.id,
            total_amount: item.price * (item.quantity || 1),
            status: 'completed',
            items: [{
              product_id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity || 1
            }]
          });
        }
      }

      // 4.5. Update stock regardless of payment method
      for (const item of selectedProducts) {
        await (supabase as any).rpc('decrement_product_stock', { 
          prod_id: item.id, 
          amount: item.quantity || 1 
        });
      }

      // 5. Update Customer Wallet (Deductions only)
      const cashbackToDeduct = useCashback ? Math.min(customerCashback, calculateTotalBeforeCashback()) : 0;
      const creditsToDeduct = useCredits ? Math.min(customerCredits, calculateTotalBeforeCredits()) : 0;
      
      if (cashbackToDeduct > 0 || creditsToDeduct > 0) {
        await supabase
          .from("customers")
          .update({ 
            cashback_balance: customerCashback - cashbackToDeduct,
            credits: customerCredits - creditsToDeduct
          })
          .eq("id", customerId);
      }

      toast.success("Agendamento concluído com sucesso! Redirecionando para o seu painel...");
      
      // Reset state and close modal
      setIsBookingOpen(false);
      setBookingStep(1);
      setSelectedProducts([]);
      setPaymentMethod(null);
      setUseCashback(false);
      
      // Delay redirection slightly to allow the toast message to be read
      setTimeout(() => {
        const portalUrl = `/${slug}/portal`;
        if (window.self !== window.top) {
          // If in iframe, tell parent to redirect
          window.parent.postMessage({ type: 'BOOKING_SUCCESS', redirectUrl: portalUrl }, '*');
          // Fallback if message not handled
          setTimeout(() => {
            window.parent.location.href = portalUrl;
          }, 500);
        } else {
          window.location.href = portalUrl;
        }
      }, 2000);
      
      
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

  const calculateTotalBeforeCashback = () => {
    const servicePrice = selectedService?.price || 0;
    const productsTotal = selectedProducts.reduce((acc, p) => acc + ((p.price || 0) * (p.quantity || 1)), 0);
    return servicePrice + productsTotal;
  };

  const calculateTotalBeforeCredits = () => {
    let total = calculateTotalBeforeCashback();
    if (useCashback) {
      total = Math.max(0, total - Math.min(customerCashback, total));
    }
    return total;
  };

  const calculateTotal = () => {
    let total = calculateTotalBeforeCredits();
    if (useCredits) {
      total = Math.max(0, total - Math.min(customerCredits, total));
    }
    return total;
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
    if (phone.length >= 10) {
      const { data } = await supabase
        .from("customers")
        .select("cashback_balance, loyalty_points, name, credits")
        .eq("phone", phone)
        .eq("user_id", shop.id)
        .maybeSingle();
      if (data) {
        setCustomerCashback(data.cashback_balance || 0);
        setCustomerLoyaltyPoints(data.loyalty_points || 0);
        setCustomerCredits(data.credits || 0);
        if (data.name) setCustomerName(data.name);
        return data;
      } else {
        setCustomerCashback(0);
        setCustomerLoyaltyPoints(0);
        setCustomerName(""); // Certificar que o nome está vazio para novos clientes
        return null;
      }
    }
    return null;
  };

  const handlePhoneCheck = async () => {
    if (!customerPhone || customerPhone.length < 8) {
      toast.error("Por favor, insira um número de WhatsApp válido.");
      return;
    }
    setSubmitting(true);
    try {
      const customer = await checkCustomerCashback(customerPhone);
      setBookingStep(2);
      if (customer) {
        toast.success(`Bem-vindo de volta, ${customer.name}!`);
      }
    } catch (error) {
      console.error("Error checking phone:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="dark min-h-screen bg-[#0a0a0a] text-slate-50 selection:bg-primary/30 overflow-x-hidden" 
      style={{ 
        backgroundColor: "#0a0a0a",
        fontFamily: shop.font_family ? `'${shop.font_family}', sans-serif` : 'Inter, sans-serif',
        fontSize: shop.font_size || '16px',
      }}
    >
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
              className="h-12 w-12 border-t-2 border-r-2 border-primary rounded-full"
              style={{ borderTopColor: primaryColor, borderRightColor: primaryColor }}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <Scissors className="h-5 w-5" style={{ color: primaryColor }} />
                </div>
              )}
              <h1 className="font-bold text-base sm:text-lg tracking-tight truncate">{shop.business_name}</h1>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-sm font-black uppercase tracking-widest text-white/70">
              <a href="#inicio" className="hover:text-primary transition-colors cursor-pointer">Início</a>
              <a href="#servicos" className="hover:text-primary transition-colors cursor-pointer">Serviços</a>
              <a href="#produtos" className="hover:text-primary transition-colors cursor-pointer">Produtos</a>
              <a href="#profissionais" className="hover:text-primary transition-colors cursor-pointer">Profissionais</a>
              <a href="#contato" className="hover:text-primary transition-colors cursor-pointer">Contato</a>
            </nav>

            <Button 
              style={{ backgroundColor: primaryColor }} 
              className="text-white shadow-lg hover:scale-105 transition-all h-10 px-6 rounded-full text-sm font-bold" 
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
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#0a0a0a] z-10" />
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
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40" style={{ WebkitTextStroke: `1px ${primaryColor}` }}>começa aqui.</span>
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
                style={{ backgroundColor: primaryColor }} 
                className="h-14 px-10 text-lg font-black rounded-full shadow-2xl hover:scale-105 transition-all w-full sm:w-auto uppercase tracking-tighter"
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
        <section id="servicos" className="py-24 bg-[#0a0a0a] relative">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
              <div className="space-y-4">
                <span className="text-primary font-black uppercase tracking-[0.2em] text-sm" style={{ color: primaryColor }}>Experiência Premium</span>
                <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Nossos Serviços</h3>
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
                  <Card className="group relative overflow-hidden border-white/5 bg-[#111] hover:bg-[#151515] transition-all duration-500 rounded-[2rem] h-full">
                    <div className="p-8 space-y-6">
                      <div className="flex justify-between items-start">
                        <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                          <Scissors className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" style={{ '--primary': primaryColor } as any} />
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black tracking-tighter" style={{ color: primaryColor }}>R$ {service.price.toFixed(2)}</p>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{service.duration_minutes} MIN</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-2xl font-black uppercase tracking-tight group-hover:translate-x-1 transition-transform duration-500">{service.name}</h4>
                        <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed">
                          Cuidado especializado com produtos de alta qualidade para um resultado impecável.
                        </p>
                      </div>

                      <Button 
                        className="w-full h-12 rounded-xl font-bold transition-all group-hover:shadow-[0_0_20px_rgba(var(--primary),0.2)]"
                        style={{ backgroundColor: primaryColor }}
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
                className="text-primary font-black uppercase tracking-[0.3em] text-xs" 
                style={{ color: primaryColor }}
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

            {/* Desktop Grid / Mobile Scroll */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {products.filter(p => p.active).map((product, idx) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="group bg-[#0a0a0a] border-white/5 rounded-[2.5rem] overflow-hidden hover:border-primary/30 transition-all duration-500 flex flex-col h-full">
                    <div className="aspect-square relative overflow-hidden bg-[#111]">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-10">
                          <Package size={80} />
                        </div>
                      )}
                      
                      {product.badge && (
                        <div className="absolute top-6 left-6 z-10">
                          <span className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-2xl" style={{ backgroundColor: primaryColor }}>
                            {product.badge}
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center gap-3">
                         <Button 
                          className="rounded-full h-12 w-12 bg-white text-black hover:bg-white/90 shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-500"
                          onClick={() => setSelectedProductProductForModal(product)}
                        >
                          <ShoppingBag size={20} />
                        </Button>
                         <Button 
                          variant="secondary"
                          className="rounded-full h-12 w-12 bg-black/60 backdrop-blur-md text-white hover:bg-black/80 shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-500"
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
                      className="p-8 flex flex-col flex-1 space-y-4 cursor-pointer"
                      onClick={() => setSelectedProductProductForModal(product)}
                    >
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{product.category || 'Cuidados'}</p>
                        <h4 className="text-xl font-black uppercase italic tracking-tighter leading-tight">{product.name}</h4>
                        {product.brand && <p className="text-xs font-bold text-primary/60" style={{ color: primaryColor }}>{product.brand}</p>}
                      </div>

                      <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed flex-1">
                        {product.short_description || product.description || "Produto selecionado com rigor para garantir resultados superiores."}
                      </p>

                      <div className="pt-4 border-t border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-2xl font-black text-white">R$ {Number(product.price).toFixed(2)}</span>
                            {product.promotional_price && (
                              <span className="text-xs text-slate-500 line-through font-bold">R$ {Number(product.promotional_price).toFixed(2)}</span>
                            )}
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Disponível</p>
                             <p className="text-xs font-bold text-slate-400">{product.stock_quantity} unidades</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            className="rounded-xl h-11 font-bold text-xs uppercase tracking-widest"
                            style={{ backgroundColor: primaryColor }}
                            onClick={() => addToCart(product)}
                          >
                            Comprar
                          </Button>
                          <Button 
                            variant="outline"
                            className="rounded-xl h-11 border-white/10 hover:bg-white/5 font-bold text-[10px] uppercase tracking-widest"
                            onClick={() => {
                              const message = encodeURIComponent(`Olá! Tenho interesse no produto ${product.name} na ${shop.business_name}.`);
                              window.open(`https://wa.me/${shop.whatsapp_number}?text=${message}`, '_blank');
                            }}
                          >
                            WhatsApp
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
        <section id="profissionais" className="py-24 bg-[#0f0f0f]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center space-y-4 mb-20">
              <span className="text-primary font-black uppercase tracking-[0.2em] text-sm" style={{ color: primaryColor }}>Elite Team</span>
              <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Especialistas</h3>
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
                        <span className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full" style={{ backgroundColor: primaryColor }}>
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
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Scissors className="h-6 w-6" style={{ color: primaryColor }} />
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
                <h5 className="font-black uppercase tracking-widest text-xs text-primary" style={{ color: primaryColor }}>Localização</h5>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-slate-500 shrink-0" />
                    <p className="text-slate-400 text-sm leading-relaxed">{shop.address || "Endereço não informado"}</p>
                  </div>
                  <Button variant="link" className="text-xs p-0 h-auto text-primary" style={{ color: primaryColor }} asChild>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address || shop.business_name)}`} target="_blank">Ver no Google Maps</a>
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                <h5 className="font-black uppercase tracking-widest text-xs text-primary" style={{ color: primaryColor }}>Links Rápidos</h5>
                <nav className="flex flex-col gap-3 text-sm font-medium text-slate-500">
                  <a href="#inicio" className="hover:text-white transition-colors">Início</a>
                  <a href="#servicos" className="hover:text-white transition-colors">Serviços</a>
                  <a href="#profissionais" className="hover:text-white transition-colors">Profissionais</a>
                  <a href={`/${slug}/portal`} className="hover:text-white transition-colors">Portal do Cliente</a>
                </nav>
              </div>

              <div className="space-y-6">
                <h5 className="font-black uppercase tracking-widest text-xs text-primary" style={{ color: primaryColor }}>Funcionamento</h5>
                <div className="space-y-2 text-sm text-slate-500 font-medium">
                  <p className="flex justify-between"><span>Seg - Sex:</span> <span className="text-white">09:00 - 20:00</span></p>
                  <p className="flex justify-between"><span>Sábado:</span> <span className="text-white">08:00 - 18:00</span></p>
                  <p className="flex justify-between"><span>Domingo:</span> <span className="text-white">Fechado</span></p>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 text-center flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-600">© 2026 {shop.business_name} - Premium Experience</p>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-800">Powered by BarberSaaS Elite</p>
            </div>
          </div>
        </footer>

        {/* Mobile Bottom CTA */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 z-40">
          <Button 
            style={{ backgroundColor: primaryColor }} 
            className="w-full h-14 rounded-2xl shadow-2xl text-white font-black uppercase tracking-tighter text-lg scale-100 active:scale-95 transition-all"
            onClick={handleBookingAction}
          >
            {shop.scheduling_mode === 'manual' ? 'Agendar WhatsApp' : 'Agendar Agora'}
          </Button>
        </div>
      </main>

      <Dialog open={isBookingOpen} onOpenChange={(open) => {
        setIsBookingOpen(open);
        if (!open) {
          setBookingStep(1);
          if (!isEmbedded) {
            setCustomerName("");
            setCustomerPhone("");
          }
          setUseCashback(false);
          setUseCredits(false);
          setPaymentMethod(null);
        }
      }}>
        <DialogContent className={cn("sm:max-w-[480px] p-0 overflow-hidden dark bg-[#0a0a0a] border-white/10 h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl", isEmbedded && "w-full max-w-full m-0 h-full rounded-none border-none")}>
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar flex flex-col bg-gradient-to-b from-white/[0.02] to-transparent">
          <DialogHeader className="flex-row items-center justify-between space-y-0 pb-6 shrink-0 border-b border-white/5 mb-6">
            <div className="flex items-center gap-3">
              {bookingStep > 1 && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 text-white" 
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
              <DialogTitle className="text-xl font-bold tracking-tight text-white">
                {bookingStep === 1 && "Bem-vindo"}
                {bookingStep === 2 && "O que faremos?"}
                {bookingStep === 3 && "Quem atende?"}
                {bookingStep === 4 && "Quando?"}
                {bookingStep === 5 && "Confirmar"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 pr-1">
            {bookingStep === 1 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8 py-4"
              >
                <div className="space-y-3">
                  <h4 className="text-3xl font-black uppercase italic tracking-tighter">Olá!</h4>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    Informe seu WhatsApp para começarmos seu agendamento premium.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3 p-6 bg-white/[0.03] rounded-3xl border border-white/10 shadow-inner">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Seu WhatsApp</Label>
                    <Input 
                      placeholder="(00) 00000-0000" 
                      value={customerPhone} 
                      onChange={(e) => setCustomerPhone(e.target.value)} 
                      className="bg-black/40 border-white/5 text-white placeholder:text-slate-700 h-16 text-2xl font-black tracking-tight focus-visible:ring-primary/50 rounded-2xl transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customerPhone) {
                          handlePhoneCheck();
                        }
                      }}
                    />
                  </div>
                  <Button 
                    className="w-full h-16 rounded-2xl text-lg font-black uppercase tracking-tighter shadow-2xl hover:scale-[1.02] transition-all" 
                    style={{ backgroundColor: primaryColor }}
                    onClick={handlePhoneCheck}
                    disabled={!customerPhone || submitting}
                  >
                    {submitting ? "Verificando..." : "Continuar"}
                  </Button>
                </div>

                <p className="text-[10px] text-center text-slate-600 font-bold uppercase tracking-[0.2em] pt-4">
                  Ambiente Seguro & Privado
                </p>
              </motion.div>
            )}

            {bookingStep === 2 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="grid gap-3 p-5 bg-white/[0.03] rounded-3xl border border-white/10">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Como podemos te chamar?</Label>
                  <Input 
                    placeholder="Seu nome" 
                    value={customerName} 
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-black/40 border-white/5 text-white placeholder:text-slate-700 h-14 text-xl font-black focus-visible:ring-primary/50 rounded-2xl"
                  />
                </div>

                <div className="space-y-4">
                  <h5 className="text-xs font-black uppercase tracking-[0.2em] text-primary" style={{ color: primaryColor }}>Selecione o Serviço</h5>
                  <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {services.map(s => (
                      <motion.div 
                        key={s.id} 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "p-5 rounded-[2rem] cursor-pointer transition-all flex justify-between items-center group relative overflow-hidden",
                          selectedService?.id === s.id ? "bg-primary text-white" : "bg-white/[0.03] border border-white/5 hover:bg-white/[0.06]"
                        )}
                        style={selectedService?.id === s.id ? { backgroundColor: primaryColor } : {}}
                        onClick={() => {
                          if (!customerName || customerName.length < 3) {
                            toast.error("Por favor, informe seu nome primeiro.");
                            return;
                          }
                          setSelectedService(s);
                          setBookingStep(3);
                        }}
                      >
                        <div className="relative z-10">
                          <p className={cn("font-black uppercase tracking-tight text-lg", selectedService?.id === s.id ? "text-white" : "text-slate-100")}>{s.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <Clock size={12} className={selectedService?.id === s.id ? "text-white/70" : "text-slate-500"} />
                             <p className={cn("text-[10px] font-black uppercase tracking-widest", selectedService?.id === s.id ? "text-white/70" : "text-slate-500")}>{s.duration_minutes} min</p>
                          </div>
                        </div>
                        <p className={cn("font-black text-xl relative z-10", selectedService?.id === s.id ? "text-white" : "text-primary")} style={selectedService?.id !== s.id ? { color: primaryColor } : {}}>R$ {s.price.toFixed(2)}</p>
                        {selectedService?.id === s.id && (
                          <motion.div layoutId="service-bg" className="absolute inset-0 bg-white/10 pointer-events-none" />
                        )}
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
                <div className="grid gap-3 p-5 bg-white/[0.03] rounded-3xl border border-white/10">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Data Desejada</Label>
                  <Input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)} 
                    min={format(new Date(), "yyyy-MM-dd")} 
                    className="bg-black/40 border-white/5 text-white h-14 text-xl font-black rounded-2xl focus-visible:ring-primary/50"
                  />
                </div>

                <div className="space-y-4">
                  <h5 className="text-xs font-black uppercase tracking-[0.2em] text-primary" style={{ color: primaryColor }}>Quem irá te atender?</h5>
                  
                  {loadingDayData ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" style={{ borderTopColor: primaryColor }} />
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Buscando disponibilidades...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {barbers
                        .filter(b => isBarberAvailableOnDate(b, selectedDate, selectedService, dayAppointments))
                        .map(b => (
                        <motion.div 
                          key={b.id} 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "p-6 rounded-[2.5rem] cursor-pointer text-center space-y-4 transition-all relative overflow-hidden group border",
                            selectedBarber?.id === b.id ? "border-primary bg-primary/20 shadow-2xl" : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06]"
                          )}
                          style={selectedBarber?.id === b.id ? { borderColor: primaryColor } : {}}
                          onClick={() => {
                            setSelectedBarber(b);
                            setBookingStep(4);
                          }}
                        >
                          <div className="relative z-10">
                            <div className="h-20 w-20 rounded-[1.5rem] bg-black/40 mx-auto overflow-hidden border-2 border-white/5 group-hover:border-primary/50 transition-colors">
                              {b.avatar_url ? (
                                <img src={b.avatar_url} className="h-full w-full object-cover" alt={b.name} />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center font-black text-2xl text-slate-100">{b.name[0]}</div>
                              )}
                            </div>
                            <div className="mt-4">
                              <p className="font-black uppercase tracking-tight text-sm text-slate-100 leading-none">{b.name}</p>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">{b.specialty || 'Especialista'}</p>
                            </div>
                          </div>
                          {selectedBarber?.id === b.id && (
                             <motion.div layoutId="barber-glow" className="absolute inset-0 bg-primary/10 blur-xl pointer-events-none" style={{ backgroundColor: `${primaryColor}20` }} />
                          )}
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
                <div className="flex items-center justify-between p-6 bg-white/[0.03] border border-white/10 rounded-[2rem] shadow-inner">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
                      {selectedBarber?.avatar_url ? <img src={selectedBarber.avatar_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center font-black text-xl">{selectedBarber?.name[0]}</div>}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Profissional</p>
                      <p className="text-xl font-black uppercase italic tracking-tighter text-white">{selectedBarber?.name}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setBookingStep(3)} className="text-[10px] h-8 font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 rounded-full px-4 border border-white/5">Alterar</Button>
                </div>

                <div className="space-y-6">
                  <h5 className="text-xs font-black uppercase tracking-[0.2em] text-primary" style={{ color: primaryColor }}>Horários Disponíveis</h5>
                  
                  {fetchingTimes ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" style={{ borderTopColor: primaryColor }} />
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Buscando horários...</p>
                    </div>
                  ) : availableTimes.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar p-1">
                      {availableTimes.map(time => (
                        <motion.button
                          key={time}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedTime(time)}
                          className={cn(
                            "h-14 rounded-2xl text-lg font-black tracking-tight transition-all border flex items-center justify-center",
                            selectedTime === time 
                              ? "text-white shadow-2xl scale-105" 
                              : "bg-white/[0.03] border-white/5 text-slate-300 hover:bg-white/[0.08] hover:border-white/20"
                          )}
                          style={selectedTime === time ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                        >
                          {time}
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                      <p className="text-sm font-black uppercase tracking-tighter text-slate-500">
                        Nenhum horário livre para hoje.
                      </p>
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full h-16 rounded-2xl text-lg font-black uppercase tracking-tighter shadow-2xl hover:scale-[1.02] transition-all" 
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => {
                    if (!selectedTime) {
                      toast.error("Por favor, selecione um horário.");
                      return;
                    }
                    setBookingStep(5);
                  }}
                  disabled={fetchingTimes || !selectedTime}
                >
                  Confirmar Detalhes
                </Button>
              </motion.div>
            )}

            {bookingStep === 5 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {shop.cashback_enabled && customerCashback > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-5 bg-primary/5 border border-primary/20 rounded-[2rem] shadow-inner"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Gift size={24} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tighter">Você tem cashback!</p>
                        <p className="text-xs font-bold text-primary">Saldo: R$ {customerCashback.toFixed(2)}</p>
                      </div>
                    </div>
                    <Button 
                      variant={useCashback ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setUseCashback(!useCashback)}
                      className={cn("font-black h-10 px-6 rounded-xl uppercase tracking-widest text-[10px]", useCashback ? "bg-primary text-white" : "border-primary/30 text-primary hover:bg-primary/10")}
                      style={useCashback ? { backgroundColor: primaryColor } : {}}
                    >
                      {useCashback ? "Aplicado" : "Usar"}
                    </Button>
                  </motion.div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Produtos Adicionais</Label>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary" style={{ color: primaryColor }}>Opcional</span>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-6 px-1 custom-scrollbar snap-x scroll-smooth">
                    {products.map(p => {
                      const cartItem = selectedProducts.find(sp => sp.id === p.id);
                      return (
                        <motion.div 
                          key={p.id}
                          whileHover={{ y: -5 }}
                          className={cn(
                            "flex-shrink-0 w-40 p-4 rounded-[2.5rem] transition-all text-center relative snap-start group border",
                            cartItem ? "bg-primary shadow-2xl text-white" : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06]"
                          )}
                          style={cartItem ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                        >
                          <div 
                            className="cursor-pointer space-y-3"
                            onClick={() => toggleProduct(p)}
                          >
                            <div className="h-24 w-24 mx-auto bg-black/40 rounded-3xl flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-white/20 transition-colors">
                              {p.image_url ? (
                                <img src={p.image_url} className="w-full h-full object-cover" />
                              ) : (
                                <Package size={32} className={cartItem ? "text-white/50" : "text-slate-700"} />
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className={cn("text-xs font-black uppercase tracking-tight truncate px-1", cartItem ? "text-white" : "text-white")}>{p.name}</p>
                              <p className={cn("text-sm font-black", cartItem ? "text-white/90" : "text-primary")} style={!cartItem ? { color: primaryColor } : {}}>R$ {p.price.toFixed(2)}</p>
                            </div>
                          </div>
                          
                          {cartItem && (
                            <div className="flex items-center justify-between mt-4 bg-black/20 rounded-2xl p-1.5 backdrop-blur-md">
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, -1); }} 
                                className="bg-white/10 hover:bg-white/20 text-white rounded-xl h-8 w-8 flex items-center justify-center transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="text-xs font-black">{cartItem.quantity}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, 1); }} 
                                className="bg-white/10 hover:bg-white/20 text-white rounded-xl h-8 w-8 flex items-center justify-center transition-colors"
                                disabled={cartItem.quantity >= p.stock_quantity}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#111] p-4 rounded-xl space-y-3 text-sm border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Serviço:</span> 
                    <span className="font-bold text-slate-100">{selectedService?.name}</span>
                  </div>
                  
                  {selectedProducts.length > 0 && (
                    <div className="space-y-2 py-2 border-y border-white/5 my-1">
                      <p className="text-[10px] font-black text-primary uppercase tracking-wider">Produtos</p>
                      {selectedProducts.map(p => (
                        <div key={p.id} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{p.name} <span className="text-primary font-bold">x{p.quantity || 1}</span></span>
                          <span className="text-slate-100 font-medium">R$ {((p.price || 0) * (p.quantity || 1)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Profissional:</span> 
                    <span className="font-bold text-slate-100">{selectedBarber?.name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Data:</span> 
                    <span className="font-bold text-slate-100">{format(parseISO(selectedDate), "dd/MM/yyyy")}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Hora:</span> 
                    <span className="font-bold text-slate-100">{selectedTime}</span>
                  </div>

                  {(useCashback || useCredits) && (
                    <div className="pt-2 border-t border-white/5 space-y-1">
                      {useCashback && (
                        <div className="flex justify-between text-green-500 font-bold text-xs">
                          <span>Desconto Cashback:</span> 
                          <span>- R$ {Math.min(customerCashback, calculateTotalBeforeCashback()).toFixed(2)}</span>
                        </div>
                      )}
                      {useCredits && (
                        <div className="flex justify-between text-green-500 font-bold text-xs">
                          <span>Desconto Créditos:</span> 
                          <span>- R$ {Math.min(customerCredits, calculateTotalBeforeCredits()).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center border-t border-white/10 pt-4 mt-3">
                    <span className="text-white font-black text-lg uppercase tracking-tighter">Total Final:</span> 
                    <span className="text-3xl font-black" style={{ color: primaryColor }}>R$ {calculateTotal().toFixed(2)}</span>
                  </div>
                  
                  {shop.cashback_enabled && (
                    <div className="bg-primary/5 p-3 rounded-xl text-[11px] text-center mt-3 border border-primary/20 shadow-inner">
                      <span className="text-slate-300 font-medium">Você receberá </span>
                      <span className="text-primary font-black">R$ {(calculateTotal() * (shop.cashback_percentage / 100)).toFixed(2)}</span>
                      <span className="text-slate-300 font-medium"> de volta nesta reserva!</span>
                    </div>
                  )}
                </div>

                {(!paymentMethod && calculateTotal() > 0) ? (
                  <div className="grid grid-cols-1 gap-3 mt-6">
                    <Button 
                      variant="outline" 
                      className="flex items-center justify-between h-20 px-6 bg-[#111] border-white/10 hover:border-primary/50 transition-all group rounded-2xl"
                      onClick={() => setPaymentMethod('barbershop')}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <Scissors size={24} className="text-slate-400 group-hover:text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-white">Pagar na Barbearia</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pague após o serviço</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-slate-600 group-hover:text-primary transition-colors" />
                    </Button>
                    <Button 
                      className="flex items-center justify-between h-20 px-6 shadow-xl transition-all hover:scale-[1.01] rounded-2xl group"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => setPaymentMethod('pix')}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <QrCode size={24} className="text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-white">Pagar Agora (PIX)</p>
                          <p className="text-[10px] text-white/70 font-bold uppercase tracking-wider">Confirmação instantânea</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-white/70 group-hover:text-white transition-colors" />
                    </Button>
                  </div>
                ) : (calculateTotal() === 0 && !paymentMethod) ? (
                  <div className="space-y-4 mt-4">
                    <div className="p-6 border-2 border-green-500/20 bg-green-500/5 rounded-xl text-center space-y-3">
                      <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={24} className="text-green-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-bold text-green-700">Valor Total Coberto!</p>
                        <p className="text-sm text-muted-foreground">O agendamento será pago com seus créditos/cashback.</p>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full h-12 text-base font-bold shadow-lg hover:shadow-primary/20 transition-all" 
                      style={{ backgroundColor: primaryColor }}
                      onClick={(e) => {
                        e.preventDefault();
                        handleFinalizeBooking();
                      }} 
                      disabled={submitting}
                    >
                      {submitting ? "Finalizando..." : "Confirmar Agendamento com Créditos"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {paymentMethod === 'pix' && calculateTotal() > 0 && (
                      <div className="p-6 border border-primary/30 bg-primary/5 rounded-3xl space-y-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-1">
                            <QrCode size={32} className="text-primary" />
                          </div>
                          <p className="text-lg font-black text-white uppercase tracking-tight">Pagamento Instantâneo</p>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Escaneie ou copie o código</p>
                        </div>
                        
                        {shop.pix_qr_code_url && (
                          <div className="flex justify-center group">
                            <div className="relative p-4 bg-white rounded-3xl shadow-xl transition-transform group-hover:scale-105 duration-300">
                              <img src={shop.pix_qr_code_url} className="h-44 w-44 object-contain" alt="PIX QR Code" />
                              <div className="absolute inset-0 border-4 border-primary/10 rounded-3xl pointer-events-none"></div>
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-3">
                          <div className="bg-[#090909] p-5 rounded-2xl border border-white/5 text-sm font-mono break-all flex flex-col items-center gap-4 shadow-inner">
                            <span className="text-center text-slate-100 font-bold text-base leading-relaxed">{shop.pix_key || "Chave não cadastrada"}</span>
                            {shop.pix_key && (
                              <Button 
                                variant="secondary" 
                                size="lg" 
                                className="w-full h-12 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-black uppercase tracking-wider text-xs"
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
                        <div className="pt-2">
                          <p className="text-[11px] text-slate-500 font-bold leading-relaxed text-center uppercase tracking-wide">
                            Após realizar o pagamento, clique no botão abaixo para finalizar seu agendamento.
                          </p>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'barbershop' && (
                      <div className="p-6 border border-white/10 bg-white/5 rounded-3xl space-y-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center mb-1">
                            <Scissors size={32} className="text-slate-400" />
                          </div>
                          <p className="text-lg font-black text-white uppercase tracking-tight">Pagar na Unidade</p>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Agendamento Presencial</p>
                        </div>

                        <div className="bg-[#090909] p-5 rounded-2xl border border-white/5 space-y-4 shadow-inner">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                              <CheckCircle2 size={20} className="text-green-500" />
                            </div>
                            <p className="text-xs text-slate-300 font-medium leading-relaxed">
                              Sua vaga será reservada imediatamente. O pagamento será feito diretamente na recepção.
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Clock size={20} className="text-primary" />
                            </div>
                            <p className="text-xs text-slate-300 font-medium leading-relaxed">
                              Chegue com 5 minutos de antecedência para garantir seu horário.
                            </p>
                          </div>
                        </div>

                        <div className="pt-2">
                          <p className="text-[11px] text-slate-500 font-bold leading-relaxed text-center uppercase tracking-wide">
                            Clique no botão abaixo para confirmar sua reserva na barbearia.
                          </p>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'pix' && calculateTotal() === 0 && (
                      <div className="p-6 border-2 border-green-500/20 bg-green-500/5 rounded-xl text-center space-y-3">
                        <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 size={24} className="text-green-600" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-bold text-green-700">Tudo pronto!</p>
                          <p className="text-sm text-muted-foreground">O valor total será quitado com seus créditos disponíveis.</p>
                        </div>
                        <div className="pt-2">
                          <p className="text-[11px] text-muted-foreground">
                            Clique no botão abaixo para concluir seu agendamento agora mesmo.
                          </p>
                        </div>
                      </div>
                    )}

                      <div className="pt-2">
                        <Button 
                          id="btn-confirm-booking"
                          className="w-full h-12 text-base font-bold shadow-lg hover:shadow-primary/20 transition-all" 
                          style={{ backgroundColor: primaryColor }}
                          onClick={(e) => {
                            e.preventDefault();
                            handleFinalizeBooking();
                          }} 
                          disabled={submitting}
                        >
                          {submitting ? "Finalizando..." : "Confirmar Agendamento"}
                        </Button>
                        
                        <Button 
                          variant="secondary" 
                          className="w-full mt-3 h-12 text-sm font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl" 
                          onClick={() => setPaymentMethod(null)}
                        >
                          Alterar forma de pagamento
                        </Button>
                      </div>
                    </div>
                  )}
              </motion.div>
            )}
          </div>

          {bookingStep > 1 && (
            <DialogFooter className="flex justify-between items-center sm:justify-between px-0 pt-6 mt-6 border-t border-white/5 shrink-0">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-400 hover:text-white"
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
              <QrCode size={20} style={{ color: primaryColor }} />
              Pagamento via PIX
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Total a pagar:</p>
              <p className="text-3xl font-bold" style={{ color: primaryColor }}>
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
              className="w-full" 
              style={{ backgroundColor: primaryColor }}
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
                  
                  // Try to find customer ID by phone if we have it
                  let saleCustomerId = null;
                  if (customerPhone) {
                    const { data: custData } = await supabase
                      .from("customers")
                      .select("id")
                      .eq("phone", customerPhone)
                      .eq("user_id", shop.id)
                      .maybeSingle();
                    if (custData) saleCustomerId = custData.id;
                  }

                  const { data: saleData, error: saleError } = await supabase.from("product_sales").insert({
                    user_id: shop.id,
                    customer_id: saleCustomerId,
                    total_amount: totalAmount,
                    status: 'completed' as any,
                    items: items as any
                  }).select().single();

                  if (saleError) throw saleError;

                  // 2. Create finance transaction for the "Financeiro" tab
                  // Since there is no specific barber for a standalone product sale, we assign to "Geral" (barber_id: null)
                  const { error: transError } = await supabase.from("transactions").insert({
                    user_id: shop.id,
                    type: "income",
                    category: "Produtos",
                    amount: totalAmount,
                    description: `Venda de Produtos (Standalone) - Itens: ${items.map(i => `${i.name} (x${i.quantity})`).join(", ")}`,
                    date: new Date().toISOString().split('T')[0]
                  });

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
              className="w-full"
              onClick={() => {
                setIsPixVisible(false);
                setIsBookingOpen(true);
                setBookingStep(1);
              }}
            >
              Agendar Serviço
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setIsPixVisible(false)}>
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
