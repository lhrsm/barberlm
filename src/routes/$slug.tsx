import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Scissors, Calendar, MapPin, Phone, MessageSquare, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/$slug")({
  component: ShopPageComponent,
});

function ShopPageComponent() {
  const { slug } = Route.useParams();
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [servicesRes, barbersRes] = await Promise.all([
      supabase.from("services").select("*").eq("user_id", profile.id).eq("active", true),
      supabase.from("barbers").select("*").eq("user_id", profile.id).eq("active", true),
    ]);

    setServices(servicesRes.data || []);
    setBarbers(barbersRes.data || []);
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

  return (
    <div className="min-h-screen bg-background" style={{ backgroundColor: shop.secondary_color || "#f4f4f5" }}>
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
          <Button style={{ backgroundColor: primaryColor }} className="text-white">
            Agendar Agora
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
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin size={16} /> Ver Localização
            </span>
          </div>
        </section>

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
              <div key={barber.id} className="text-center group cursor-pointer">
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
                <p className="text-xs text-muted-foreground">{barber.specialty || 'Barbeiro'}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer info */}
        <section className="pt-8 border-t text-center text-sm text-muted-foreground">
          <p>© 2026 {shop.business_name} - Todos os direitos reservados.</p>
          <p className="mt-2">Desenvolvido por BarberSaaS</p>
        </section>
      </main>

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
    </div>
  );
}
