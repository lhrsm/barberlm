import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Scissors, Calendar, MapPin, Phone, MessageSquare, Clock, CheckCircle2, ChevronRight, ChevronLeft, ShoppingBag, Package, Gift, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, addMinutes, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/$slug")({
  component: ShopPageComponent,
});

function ShopPageComponent() {
  const { slug } = Route.useParams();
  const [shop, setShop] = useState<any>(null);

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
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Booking state
  const [isBookingOpen, setIsBookingOpen] = useState(false);
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
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [customerCashback, setCustomerCashback] = useState(0);
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = useState(0);
  const [useCashback, setUseCashback] = useState(false);

  useEffect(() => {
    fetchShopData();
  }, [slug]);

  async function fetchShopData() {
    setLoading(true);
    // Fetch profile by slug
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("slug", slug)
      .single();

    if (profileError || !profile) {
      setLoading(false);
      return;
    }

    setShop(profile);

    // Fetch services and barbers for this shop
    const [servicesRes, barbersRes, productsRes] = await Promise.all([
      supabase.from("services").select("*").eq("user_id", profile.id).eq("active", true),
      supabase.from("barbers").select("*, barber_services(service_id)").eq("user_id", profile.id).eq("active", true),
      supabase.from("products").select("*").eq("user_id", profile.id).eq("active", true),
    ]);

    setServices(servicesRes.data || []);
    setBarbers(barbersRes.data || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
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

  const primaryColor = shop.primary_color || "#7c3aed";

  const handleBookingAction = () => {
    if (shop.scheduling_mode === 'manual') {
      const message = encodeURIComponent(`Olá! Gostaria de agendar um horário na ${shop.business_name}.`);
      window.open(`https://wa.me/${shop.whatsapp_number}?text=${message}`, '_blank');
    } else {
      setIsBookingOpen(true);
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
        .select("id, cashback_balance")
        .eq("phone", customerPhone)
        .eq("user_id", shop.id)
        .maybeSingle();

      let customerId;
      if (customerData) {
        customerId = customerData.id;
      } else {
        const { data: newCustomer, error: createError } = await supabase
          .from("customers")
          .insert({
            user_id: shop.id,
            name: customerName,
            phone: customerPhone
          })
          .select("id")
          .single();
        
        if (createError) throw createError;
        customerId = newCustomer.id;
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
          total_price: calculateTotal(),
          status: "scheduled"
        })
        .select()
        .single();

      if (appError) throw appError;

      // 3. Handle Cashback and Products
      if (shop.cashback_enabled) {
        let newBalance = (customerData?.cashback_balance || 0);
        
        if (useCashback) {
          const discount = Math.min(newBalance, calculateTotalBeforeCashback());
          newBalance -= discount;
        }

        // Add new cashback earned
        const earned = (calculateTotalBeforeCashback() * (shop.cashback_percentage / 100));
        newBalance += earned;

        await supabase
          .from("customers")
          .update({ cashback_balance: newBalance })
          .eq("id", customerId);
      }

      // 4. Create transactions for products if any
      for (const item of selectedProducts) {
        await supabase.from("transactions").insert({
          user_id: shop.id,
          appointment_id: appointment.id,
          type: "income",
          category: "product_sale",
          amount: item.price * (item.quantity || 1),
          description: `Venda de Produto: ${item.name} (x${item.quantity || 1})`,
          date: new Date().toISOString().split('T')[0]
        });

        // Update stock
        await (supabase as any).rpc('decrement_product_stock', { 
          prod_id: item.id, 
          amount: item.quantity || 1 
        });
      }

      toast.success("Agendamento realizado com sucesso!");
      setIsBookingOpen(false);
      setBookingStep(1);
      
      // If WhatsApp is enabled, could trigger a notification here
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

  const calculateTotal = () => {
    const total = calculateTotalBeforeCashback();
    if (useCashback) {
      return Math.max(0, total - customerCashback);
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
        .select("cashback_balance, loyalty_points")
        .eq("phone", phone)
        .eq("user_id", shop.id)
        .maybeSingle();
      if (data) {
        setCustomerCashback(data.cashback_balance || 0);
        setCustomerLoyaltyPoints(data.loyalty_points || 0);
      } else {
        setCustomerCashback(0);
        setCustomerLoyaltyPoints(0);
      }
    }
  };

  return (
    <div 
      className="min-h-screen bg-background" 
      style={{ 
        backgroundColor: shop.secondary_color || "#f4f4f5",
        fontFamily: shop.font_family ? `'${shop.font_family}', sans-serif` : 'Inter, sans-serif',
        fontSize: shop.font_size || '16px',
        color: shop.font_color || '#000000'
      }}
    >
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.business_name} className="h-10 w-10 object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Scissors className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
            )}
            <h1 className="font-bold text-lg">{shop.business_name}</h1>
          </div>
          <Button style={{ backgroundColor: primaryColor }} className="text-white" onClick={handleBookingAction}>
            {shop.scheduling_mode === 'manual' ? 'Agendar via WhatsApp' : 'Agendar Agora'}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero / About */}
        <section className="text-center space-y-4">
          <h2 className="text-3xl font-extrabold tracking-tight">Bem-vindo à {shop.business_name}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Escolha o serviço desejado e o profissional de sua preferência para agendar seu horário.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
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
            {shop.address && (
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-muted-foreground hover:underline"
              >
                <MapPin size={16} /> {shop.address}
              </a>
            )}
          </div>
        </section>

        {/* Map Section */}
        {shop.google_maps_url && (
          <section className="rounded-2xl overflow-hidden border shadow-sm h-64 sm:h-80 bg-muted">
            {shop.google_maps_url.includes('<iframe') ? (
              <div 
                className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full border-none"
                dangerouslySetInnerHTML={{ __html: shop.google_maps_url }}
              />
            ) : (
              <iframe
                title="Google Maps"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                src={shop.google_maps_url}
                allowFullScreen
              />
            )}
          </section>
        )}

        {/* Services */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Scissors className="h-5 w-5" style={{ color: primaryColor }} />
            <h3 className="text-xl font-bold">Nossos Serviços</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((service) => (
              <Card key={service.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold">{service.name}</h4>
                    <p className="text-sm text-muted-foreground">{service.duration_minutes} min</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg" style={{ color: primaryColor }}>R$ {service.price.toFixed(2)}</p>
                    <Button variant="outline" size="sm" className="mt-2">Selecionar</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Barbers */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5" style={{ color: primaryColor }} />
            <h3 className="text-xl font-bold">Profissionais</h3>
          </div>
          <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
            {barbers.map((barber) => (
              <div 
                key={barber.id} 
                className="text-center group cursor-pointer"
                onClick={() => {
                  setModalBarber(barber);
                  setIsServicesModalOpen(true);
                }}
              >
                <div className="h-20 w-20 rounded-full bg-muted mx-auto mb-2 overflow-hidden border-2 transition-colors group-hover:border-primary">
                  {barber.avatar_url ? (
                    <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/5">
                      <span className="text-xl font-bold" style={{ color: primaryColor }}>{barber.name[0]}</span>
                    </div>
                  )}
                </div>
                <p className="font-medium text-sm">{barber.name}</p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Star size={12} className="text-yellow-500" fill="currentColor" />
                  <span className="text-xs font-bold">{barber.average_rating || "5.0"}</span>
                  <span className="text-[10px] text-muted-foreground">({barber.total_ratings || 0})</span>
                </div>
                <p className="text-xs text-muted-foreground">{barber.specialty || 'Barbeiro'}</p>
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

        {/* Cancellation Section */}
        <section className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/20 text-center space-y-4">
          <div className="space-y-2">
            <h4 className="font-bold">Gerenciar seu Agendamento</h4>
            <p className="text-sm text-muted-foreground">Use o código enviado no seu WhatsApp para cancelar ou avaliar seu atendimento.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setIsCancelModalOpen(true)}>
              Cancelar Agendamento
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => setIsCancelModalOpen(true)}>
              <Star size={14} /> Avaliar Atendimento
            </Button>
          </div>
        </section>

        {/* Footer info */}
        <section className="pt-8 border-t text-center text-sm text-muted-foreground">
          <p>© 2026 {shop.business_name} - Todos os direitos reservados.</p>
          <p className="mt-2">Desenvolvido por BarberSaaS</p>
        </section>
      </main>

      {/* Booking Dialog */}
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {bookingStep === 1 && "Escolha o Serviço"}
              {bookingStep === 2 && "Escolha o Profissional"}
              {bookingStep === 3 && "Data e Horário"}
              {bookingStep === 4 && "Suas Informações"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {bookingStep === 1 && (
              <div className="space-y-3">
                {services.map(s => (
                  <div 
                    key={s.id} 
                    className={cn(
                      "p-3 border rounded-lg cursor-pointer transition-colors flex justify-between items-center",
                      selectedService?.id === s.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                    )}
                    onClick={() => {
                      setSelectedService(s);
                      setBookingStep(2);
                    }}
                  >
                    <div>
                      <p className="font-bold">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.duration_minutes} min</p>
                    </div>
                    <p className="font-bold" style={{ color: primaryColor }}>R$ {s.price.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}

            {bookingStep === 2 && (
              <div className="grid grid-cols-2 gap-4">
                {barbers.map(b => (
                  <div 
                    key={b.id} 
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer text-center space-y-2 transition-colors",
                      selectedBarber?.id === b.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                    )}
                    onClick={() => {
                      setSelectedBarber(b);
                      setBookingStep(3);
                    }}
                  >
                    <div className="h-16 w-16 rounded-full bg-muted mx-auto overflow-hidden">
                      {b.avatar_url ? <img src={b.avatar_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center font-bold text-lg">{b.name[0]}</div>}
                    </div>
                    <p className="font-medium text-sm">{b.name}</p>
                  </div>
                ))}
              </div>
            )}

            {bookingStep === 3 && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Data</Label>
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={format(new Date(), "yyyy-MM-dd")} />
                </div>
                <div className="grid gap-2">
                  <Label>Horário</Label>
                  <Input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} />
                </div>
                <Button className="w-full mt-2" onClick={() => setBookingStep(4)}>Próximo</Button>
              </div>
            )}

            {bookingStep === 4 && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Seu Nome</Label>
                  <Input placeholder="Como podemos te chamar?" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Seu WhatsApp</Label>
                  <Input 
                    placeholder="(00) 00000-0000" 
                    value={customerPhone} 
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      checkCustomerCashback(e.target.value);
                    }} 
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

                <Button className="w-full" onClick={handleFinalizeBooking} disabled={submitting}>
                  {submitting ? "Finalizando..." : "Confirmar Agendamento"}
                </Button>
              </div>
            )}
          </div>

          {bookingStep > 1 && (
            <DialogFooter>
              <Button variant="ghost" className="w-full" onClick={() => setBookingStep(bookingStep - 1)}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Serviços de {modalBarber?.name}</DialogTitle>
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
    </div>
  );
}
