import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Scissors, Calendar, MapPin, Phone, MessageSquare, Clock, CheckCircle2, ChevronRight, ChevronLeft, ShoppingBag, Package, Gift, Trash2, Star, QrCode, User as UserIcon, RefreshCcw, CircleDollarSign } from "lucide-react";
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
});

function ShopPageComponent() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const isEmbedded = searchParams.get('embed') === 'true';
  const initialPhone = searchParams.get('phone') || "";
  const initialName = searchParams.get('name') || "";
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
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
    // Fetch profile by slug
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("slug", targetSlug);

      if (profileError || !profile || profile.length === 0) {
        setLoading(false);
        return;
      }

      setShop(profile[0]);
      const currentShop = profile[0];

      // Fetch services and barbers for this shop
      const [servicesRes, barbersRes, productsRes] = await Promise.all([
        supabase.from("services").select("*").eq("user_id", currentShop.id).eq("active", true),
        supabase.from("barbers").select("*, barber_services(service_id)").eq("user_id", currentShop.id).eq("active", true),
        supabase.from("products").select("*").eq("user_id", currentShop.id).eq("active", true),
      ]);

      setServices(servicesRes.data || []);
      setBarbers(barbersRes.data || []);
      setProducts(productsRes.data || []);
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

  const isPortalRoute = window.location.pathname.endsWith('/portal');

  if (isPortalRoute) {
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

      toast.success("Agendamento realizado com sucesso!");
      
      // Reset state and close modal
      setIsBookingOpen(false);
      setBookingStep(1);
      setSelectedProducts([]);
      setPaymentMethod(null);
    setUseCashback(false);
      
      // Delay redirection slightly to ensure state is clear
      setTimeout(() => {
        if (window.self !== window.top) {
          // If in iframe, tell parent to reload or redirect
          window.parent.postMessage({ type: 'BOOKING_SUCCESS' }, '*');
          // Fallback if message not handled
          setTimeout(() => {
            window.parent.location.href = `/${slug}/portal`;
          }, 1000);
        } else {
          window.location.href = `/${slug}/portal`;
        }
      }, 500);
      
      
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
      className="dark min-h-screen bg-[#0a0a0a] text-slate-50 selection:bg-primary/30" 
      style={{ 
        backgroundColor: "#0a0a0a",
        fontFamily: shop.font_family ? `'${shop.font_family}', sans-serif` : 'Inter, sans-serif',
        fontSize: shop.font_size || '16px',
      }}
    >
      {/* Header */}
      {!isEmbedded && (
        <header className="bg-card/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={shop.business_name} className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded-lg shrink-0" />
              ) : (
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Scissors className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: primaryColor }} />
                </div>
              )}
              <h1 className="font-bold text-sm sm:text-lg tracking-tight truncate">{shop.business_name}</h1>
            </div>
            <Button 
              style={{ backgroundColor: primaryColor }} 
              className="text-white shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:brightness-110 transition-all shrink-0 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm" 
              onClick={handleBookingAction}
            >
              <span className="sm:hidden">Agendar</span>
              <span className="hidden sm:inline">{shop.scheduling_mode === 'manual' ? 'Agendar via WhatsApp' : 'Agendar Agora'}</span>
            </Button>
          </div>
        </header>
      )}

      <main className={cn("max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8", isEmbedded && "py-0")}>
        {isEmbedded ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            {!isBookingOpen ? (
              <div className="text-center space-y-4">
                <h3 className="text-xl font-bold">Pronto para agendar?</h3>
                <Button size="lg" style={{ backgroundColor: primaryColor }} onClick={() => setIsBookingOpen(true)}>
                  Começar Agendamento
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">O formulário de agendamento está aberto acima.</p>
            )}
          </div>
        ) : (
          <>
            {/* Hero / About */}
        <section className="text-center space-y-4 sm:space-y-6 py-6 sm:py-10 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tighter sm:text-5xl lg:text-6xl uppercase italic leading-tight">
              Bem-vindo à <span style={{ color: primaryColor }}>{shop.business_name}</span>
            </h2>
            <div className="h-1 w-16 sm:w-20 bg-primary mx-auto rounded-full" style={{ backgroundColor: primaryColor }} />
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg leading-relaxed px-2">
            Excelência em cortes e cuidados masculinos. Escolha o serviço e agende sua experiência.
          </p>
          <div className="flex justify-center px-4">
            <Button 
              size="lg" 
              style={{ backgroundColor: primaryColor }} 
              className="h-12 px-8 text-base sm:text-lg font-bold rounded-full shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:scale-105 transition-all w-full sm:w-auto"
              onClick={handleBookingAction}
            >
              Agendar Agora
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium pt-4">
            {shop.whatsapp_enabled && shop.whatsapp_number && (
              <a 
                href={`https://wa.me/${shop.whatsapp_number}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 text-green-600 hover:underline"
              >
                <MessageSquare size={16} /> WhatsApp
              </a>
            )}
          </div>
        </section>


        {/* Services */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Scissors className="h-5 w-5" style={{ color: primaryColor }} />
            </div>
            <h3 className="text-xl font-bold tracking-tight">Nossos Serviços</h3>
          </div>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {services.map((service) => (
              <Card key={service.id} className="overflow-hidden border-white/5 bg-card/40 hover:bg-card/60 transition-all hover:scale-[1.02] cursor-pointer group">
                <CardContent className="p-4 sm:p-5 flex justify-between items-center gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h4 className="font-bold text-base sm:text-lg group-hover:text-primary transition-colors truncate">{service.name}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                      <Clock size={14} /> {service.duration_minutes} min
                    </p>
                  </div>
                  <div className="text-right space-y-2 shrink-0">
                    <p className="font-bold text-lg sm:text-xl" style={{ color: primaryColor }}>R$ {service.price.toFixed(2)}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-primary/20 hover:bg-primary hover:text-white transition-all h-8 text-xs sm:text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectService(service);
                      }}
                    >
                      Selecionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Barbers */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5" style={{ color: primaryColor }} />
            </div>
            <h3 className="text-xl font-bold tracking-tight">Profissionais</h3>
          </div>
          <div className="flex flex-wrap gap-8 justify-center sm:justify-start">
            {barbers.map((barber) => (
              <div 
                key={barber.id} 
                className="text-center group cursor-pointer"
                onClick={() => {
                  setModalBarber(barber);
                  setIsServicesModalOpen(true);
                }}
              >
                <div className="h-24 w-24 rounded-2xl bg-muted mx-auto mb-3 overflow-hidden border-2 border-transparent transition-all group-hover:border-primary group-hover:scale-105 shadow-lg">
                  {barber.avatar_url ? (
                    <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/5">
                      <span className="text-2xl font-bold" style={{ color: primaryColor }}>{barber.name[0]}</span>
                    </div>
                  )}
                </div>
                <p className="font-bold text-sm tracking-tight">{barber.name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Star size={12} className="text-yellow-500" fill="currentColor" />
                  <span className="text-xs font-bold">{barber.average_rating || "5.0"}</span>
                  <span className="text-[10px] text-muted-foreground">({barber.total_ratings || 0})</span>
                </div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1">{barber.specialty || 'Barbeiro'}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Products */}
        {products.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5" style={{ color: primaryColor }} />
              <h3 className="text-xl font-bold">Nossos Produtos</h3>
            </div>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
              {products.map((product) => {
                const cartItem = selectedProducts.find(p => p.id === product.id);
                return (
                  <Card key={product.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      {product.stock_quantity <= 0 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white font-bold text-xs px-2 py-1 bg-red-600 rounded">Esgotado</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h4 className="font-bold text-sm truncate">{product.name}</h4>
                      <div className="flex justify-between items-center mt-1">
                        <p className="font-bold text-primary" style={{ color: primaryColor }}>R$ {product.price.toFixed(2)}</p>
                        <span className="text-[10px] text-muted-foreground">Estoque: {product.stock_quantity}</span>
                      </div>
                      
                      {cartItem ? (
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => updateQuantity(product.id, -1)}
                          >
                            -
                          </Button>
                          <span className="font-bold text-sm">{cartItem.quantity}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => updateQuantity(product.id, 1)}
                            disabled={cartItem.quantity >= product.stock_quantity}
                          >
                            +
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-2 h-8 text-xs"
                          onClick={() => addToCart(product)}
                          disabled={product.stock_quantity <= 0}
                        >
                          {product.stock_quantity <= 0 ? "Indisponível" : "Comprar"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Client Portal Access Section */}
        <section className="bg-primary/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-primary/10 text-center space-y-5 sm:space-y-6">
          <div className="max-w-md mx-auto space-y-2">
            <h4 className="text-xl sm:text-2xl font-bold">Área do Cliente</h4>
            <p className="text-sm sm:text-base text-muted-foreground">
              Acesse seu portal exclusivo para ver seu histórico de serviços, compras e gerenciar seus agendamentos em um só lugar.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 sm:gap-4">
            <Button 
              size="lg"
              className="px-6 sm:px-8 rounded-full shadow-lg hover:shadow-primary/20 transition-all gap-2 w-full sm:w-auto"
              style={{ backgroundColor: primaryColor }}
              asChild
            >
              <a href={`/${slug}/portal`}>
                <UserIcon size={20} /> Entrar no Portal
              </a>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-6 sm:px-8 gap-2 w-full sm:w-auto" onClick={() => setIsCancelModalOpen(true)}>
              <Star size={20} /> Avaliar Serviço
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Login rápido usando seu número de telefone.
          </p>
        </section>

        {/* Localização e Mapa */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            <h3 className="text-xl font-bold">Onde estamos</h3>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-start">
            <div className="space-y-6">
              <Card className="bg-card/50 backdrop-blur-sm border-white/5 overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 mb-1">Endereço</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {shop.address || "Endereço não informado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 mb-1">Horário de Atendimento</h4>
                      <p className="text-muted-foreground text-sm">
                        Consulte nossos profissionais disponíveis no agendamento.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Phone className="h-5 w-5" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 mb-1">Contato</h4>
                      <p className="text-muted-foreground text-sm">
                        {shop.whatsapp_number || "Não informado"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl gap-2 hover:bg-primary/10 border-white/10"
                asChild
              >
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address || shop.business_name)}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <MapPin size={18} /> Abrir no Google Maps
                </a>
              </Button>
            </div>

            <div className="h-[280px] sm:h-[350px] w-full rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative bg-muted/20">
              <iframe
                title="Google Maps"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(shop.address || shop.business_name)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </section>

        {/* Footer info */}
        <section className="pt-12 pb-8 border-t border-white/5 text-center text-sm text-muted-foreground space-y-4">
          <div className="flex justify-center gap-6 mb-4">
            {shop.whatsapp_number && (
              <a href={`https://wa.me/${shop.whatsapp_number}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                <MessageSquare size={20} />
              </a>
            )}
            <a href="#" className="hover:text-primary transition-colors">
              <Star size={20} />
            </a>
          </div>
          <p>© 2026 {shop.business_name} - Todos os direitos reservados.</p>
          <p className="text-[10px] uppercase tracking-widest opacity-50">Desenvolvido por BarberSaaS</p>
        </section>
          </>
        )}
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
        <DialogContent className={cn("sm:max-w-[425px] dark bg-card border-white/5", isEmbedded && "w-full max-w-full m-0 h-[90vh] overflow-y-auto")}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {bookingStep === 1 && "Informe seu WhatsApp"}
              {bookingStep === 2 && "Escolha o Serviço"}
              {bookingStep === 3 && "Escolha o Profissional"}
              {bookingStep === 4 && "Data e Horário"}
              {bookingStep === 5 && "Finalizar Agendamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {bookingStep === 1 && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Seu WhatsApp</Label>
                  <Input 
                    placeholder="(00) 00000-0000" 
                    value={customerPhone} 
                    onChange={(e) => setCustomerPhone(e.target.value)} 
                    className="bg-[#111] border-white/10 text-white placeholder:text-slate-500 h-12 text-lg focus-visible:ring-primary/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customerPhone) {
                        handlePhoneCheck();
                      }
                    }}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handlePhoneCheck}
                  disabled={!customerPhone || submitting}
                >
                  Continuar
                </Button>
              </div>
            )}

            {bookingStep === 2 && (
              <div className="space-y-3">
                <div className="grid gap-2 mb-4 animate-in fade-in slide-in-from-top-2">
                  <Label>Como podemos te chamar?</Label>
                  <Input 
                    placeholder="Seu nome" 
                    value={customerName} 
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-[#111] border-white/10 text-white placeholder:text-slate-500 h-12 text-lg focus-visible:ring-primary/50"
                  />
                </div>
                {customerName && customerName.length >= 3 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-medium mb-2">Olá, <span style={{ color: primaryColor }}>{customerName}</span>! O que faremos hoje?</p>
                  </div>
                )}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {services.map(s => (
                    <div 
                      key={s.id} 
                      className={cn(
                        "p-4 border rounded-xl cursor-pointer transition-all flex justify-between items-center",
                        selectedService?.id === s.id ? "border-primary bg-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.2)]" : "bg-[#111] border-white/5 hover:bg-[#1a1a1a] hover:border-white/10"
                      )}
                      onClick={() => {
                        if (!customerName) {
                          toast.error("Por favor, informe seu nome primeiro.");
                          return;
                        }
                        setSelectedService(s);
                        setBookingStep(3);
                      }}
                    >
                      <div>
                        <p className="font-bold text-slate-100">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.duration_minutes} min</p>
                      </div>
                      <p className="font-bold text-lg" style={{ color: primaryColor }}>R$ {s.price.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bookingStep === 3 && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Data do Agendamento</Label>
                  <Input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)} 
                    min={format(new Date(), "yyyy-MM-dd")} 
                    className="bg-[#111] border-white/10 text-white h-12 text-lg focus-visible:ring-primary/50"
                  />
                  <p className="text-[10px] text-muted-foreground">Selecione uma data para ver os profissionais disponíveis.</p>
                </div>

                <div className="space-y-2">
                  <Label>Escolha o Profissional</Label>
                  {loadingDayData ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {barbers
                        .filter(b => isBarberAvailableOnDate(b, selectedDate, selectedService, dayAppointments))
                        .map(b => (
                        <div 
                          key={b.id} 
                          className={cn(
                            "p-4 border rounded-xl cursor-pointer text-center space-y-2 transition-all",
                            selectedBarber?.id === b.id ? "border-primary bg-primary/20" : "bg-[#111] border-white/5 hover:bg-[#1a1a1a]"
                          )}
                          onClick={() => {
                            setSelectedBarber(b);
                            setBookingStep(4);
                          }}
                        >
                          <div className="h-16 w-16 rounded-full bg-muted mx-auto overflow-hidden">
                            {b.avatar_url ? <img src={b.avatar_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center font-bold text-lg">{b.name[0]}</div>}
                          </div>
                          <p className="font-medium text-sm">{b.name}</p>
                        </div>
                      ))}
                      {barbers.filter(b => isBarberAvailableOnDate(b, selectedDate, selectedService, dayAppointments)).length === 0 && (
                        <div className="col-span-2 py-8 text-center space-y-2">
                          <p className="text-sm text-muted-foreground">Nenhum profissional disponível para esta data.</p>
                          <p className="text-xs text-muted-foreground">Tente selecionar outro dia.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {bookingStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-muted overflow-hidden">
                      {selectedBarber?.avatar_url ? <img src={selectedBarber.avatar_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center font-bold">{selectedBarber?.name[0]}</div>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Profissional</p>
                      <p className="text-sm font-bold">{selectedBarber?.name}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setBookingStep(3)} className="text-xs h-8">Alterar</Button>
                </div>
                <div className="grid gap-2">
                  <Label>Data</Label>
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={format(new Date(), "yyyy-MM-dd")} />
                </div>
                <div className="grid gap-2">
                  <Label>Horário</Label>
                  {fetchingTimes ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : availableTimes.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto p-1">
                      {availableTimes.map(time => (
                        <Button
                          key={time}
                          type="button"
                          variant={selectedTime === time ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedTime(time)}
                          className={cn(selectedTime === time && "bg-primary")}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-center text-muted-foreground py-4">
                      Nenhum horário disponível para esta data.
                    </p>
                  )}
                </div>
                <Button 
                  className="w-full mt-2" 
                  onClick={() => {
                    if (!selectedTime) {
                      toast.error("Por favor, selecione um horário.");
                      return;
                    }
                    
                    // Se o cliente tiver cashback, pode usar
                    setBookingStep(5);
                  }}
                  disabled={fetchingTimes || !selectedDate}
                >
                  Próximo
                </Button>
              </div>
            )}

            {bookingStep === 5 && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>WhatsApp</Label>
                  <Input 
                    value={customerPhone} 
                    readOnly 
                    className="bg-muted text-muted-foreground"
                  />
                </div>
                
                {shop.cashback_enabled && customerCashback > 0 && (
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Gift size={18} className="text-primary" />
                      <div>
                        <p className="text-sm font-bold">Você tem cashback!</p>
                        <p className="text-xs text-muted-foreground">Saldo: R$ {customerCashback.toFixed(2)}</p>
                      </div>
                    </div>
                    <Button 
                      variant={useCashback ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setUseCashback(!useCashback)}
                    >
                      {useCashback ? "Usando" : "Usar"}
                    </Button>
                  </div>
                )}

                {customerLoyaltyPoints > 0 && (
                  <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift size={18} className="text-primary" />
                      <p className="text-sm font-bold">Seu Cartão Fidelidade</p>
                    </div>
                    <Progress 
                      value={((customerLoyaltyPoints % (shop.free_service_threshold || 10)) / (shop.free_service_threshold || 10)) * 100} 
                      className="h-1.5" 
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                      Você já completou {customerLoyaltyPoints} procedimento(s). 
                      Faltam {(shop.free_service_threshold || 10) - (customerLoyaltyPoints % (shop.free_service_threshold || 10))} para o próximo gratuito!
                    </p>
                  </div>
                )}
                
                {customerCredits > 0 && (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CircleDollarSign size={18} className="text-green-600" />
                      <div>
                        <p className="text-sm font-bold text-green-800">Você tem créditos!</p>
                        <p className="text-xs text-green-600">Saldo: R$ {customerCredits.toFixed(2)}</p>
                      </div>
                    </div>
                    <Button 
                      variant={useCredits ? "default" : "outline"} 
                      size="sm" 
                      className={cn(useCredits && "bg-green-600 hover:bg-green-700")}
                      onClick={() => {
                        setUseCredits(!useCredits);
                        if (!useCredits) setUseCashback(false);
                      }}
                    >
                      {useCredits ? "Usando" : "Usar"}
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Deseja adicionar algum produto?</Label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {products.map(p => {
                      const cartItem = selectedProducts.find(sp => sp.id === p.id);
                      return (
                        <div 
                          key={p.id}
                          className={cn(
                            "flex-shrink-0 w-28 p-2 border rounded-lg transition-all text-center relative",
                            cartItem ? "border-primary bg-primary/5" : "hover:bg-muted"
                          )}
                        >
                          <div 
                            className="cursor-pointer"
                            onClick={() => toggleProduct(p)}
                          >
                            <div className="h-10 w-10 mx-auto mb-1">
                              {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover rounded" /> : <Package size={20} className="mx-auto text-muted-foreground" />}
                            </div>
                            <p className="text-[10px] font-bold truncate">{p.name}</p>
                            <p className="text-[10px] text-primary" style={{ color: primaryColor }}>R$ {p.price.toFixed(2)}</p>
                          </div>
                          
                          {cartItem && (
                            <div className="flex items-center justify-between mt-1 px-1">
                              <button onClick={() => updateQuantity(p.id, -1)} className="text-primary hover:bg-primary/10 rounded h-4 w-4 flex items-center justify-center">-</button>
                              <span className="text-[10px] font-bold">{cartItem.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(p.id, 1)} 
                                className="text-primary hover:bg-primary/10 rounded h-4 w-4 flex items-center justify-center"
                                disabled={cartItem.quantity >= p.stock_quantity}
                              >+</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Serviço:</span> <span>{selectedService?.name}</span></div>
                  {selectedProducts.length > 0 && (
                    <div className="space-y-1 py-1 border-y border-dashed my-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Produtos</p>
                      {selectedProducts.map(p => (
                        <div key={p.id} className="flex justify-between text-[11px]">
                          <span>{p.name} (x{p.quantity || 1})</span>
                          <span>R$ {((p.price || 0) * (p.quantity || 1)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Profissional:</span> <span>{selectedBarber?.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Data:</span> <span>{format(parseISO(selectedDate), "dd/MM/yyyy")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Hora:</span> <span>{selectedTime}</span></div>
                  {useCashback && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Desconto Cashback:</span> 
                      <span>- R$ {Math.min(customerCashback, calculateTotalBeforeCashback()).toFixed(2)}</span>
                    </div>
                  )}
                  {useCredits && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Desconto Créditos:</span> 
                      <span>- R$ {Math.min(customerCredits, calculateTotalBeforeCredits()).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span className="text-muted-foreground">Total:</span> 
                    <span style={{ color: primaryColor }}>R$ {calculateTotal().toFixed(2)}</span>
                  </div>
                  {shop.cashback_enabled && (
                    <div className="text-[10px] text-muted-foreground text-center mt-2">
                      Você ganhará R$ {(calculateTotal() * (shop.cashback_percentage / 100)).toFixed(2)} de volta após o atendimento!
                    </div>
                  )}
                </div>

                {(!paymentMethod && calculateTotal() > 0) ? (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-auto py-4 gap-2"
                      onClick={() => setPaymentMethod('barbershop')}
                    >
                      <Scissors size={20} />
                      <div className="text-xs">Pagar na Barbearia</div>
                    </Button>
                    <Button 
                      className="flex flex-col h-auto py-4 gap-2"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => setPaymentMethod('pix')}
                    >
                      <QrCode size={20} />
                      <div className="text-xs">Pagar Agora (PIX)</div>
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
                      <div className="p-4 border-2 border-primary/20 bg-primary/5 rounded-xl space-y-4 text-center">
                        <p className="text-sm font-bold flex items-center justify-center gap-2">
                          <QrCode size={18} className="text-primary" /> Pagamento via PIX
                        </p>
                        
                        {shop.pix_qr_code_url && (
                          <div className="flex justify-center">
                            <img src={shop.pix_qr_code_url} className="h-40 w-40 object-contain bg-white p-2 rounded-lg border shadow-sm" alt="PIX" />
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Chave PIX</p>
                          <div className="bg-background p-3 rounded-lg border border-primary/20 text-xs font-mono break-all flex items-center justify-between gap-2 shadow-inner">
                            <span className="flex-1 text-center">{shop.pix_key || "Chave não cadastrada"}</span>
                            {shop.pix_key && (
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-8 px-3 shrink-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(shop.pix_key);
                                  toast.success("Copiado!");
                                }}
                              >
                                <CheckCircle2 size={14} className="mr-1" /> Copiar
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="pt-2">
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Após realizar o pagamento, clique no botão de confirmação abaixo para finalizar seu agendamento.
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
                    
                    {paymentMethod === 'barbershop' && (
                      <div className="p-6 border-2 border-dashed border-primary/30 rounded-xl text-center bg-muted/30 space-y-3">
                        <div className="h-12 w-12 bg-primary/5 rounded-full flex items-center justify-center mx-auto">
                          <Scissors size={24} className="text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-medium">Pagamento na Barbearia</p>
                          <p className="text-sm text-muted-foreground">O pagamento será realizado no momento do atendimento.</p>
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
                        variant="ghost" 
                        className="w-full mt-2 text-xs h-10" 
                        onClick={() => setPaymentMethod(null)}
                      >
                        Alterar forma de pagamento
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {bookingStep > 1 && (
            <DialogFooter className="flex justify-between items-center sm:justify-between">
              <Button variant="ghost" size="sm" onClick={() => setBookingStep(prev => prev - 1)}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              {bookingStep < 5 && (
                <div className="text-[10px] text-muted-foreground">
                  Passo {bookingStep} de 5
                </div>
              )}
            </DialogFooter>
          )}
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
    </div>
  );
}
