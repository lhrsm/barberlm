import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Check, X as XIcon, EyeOff, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/reviews")({
  component: ReviewsAdminPage,
});

function StarsDisplay({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-500 text-xs">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-4 w-4",
            n <= value ? "text-[#D4AF37] fill-[#D4AF37]" : "text-gray-600"
          )}
        />
      ))}
      <span className="ml-1 text-xs text-gray-300 font-bold">{value}</span>
    </div>
  );
}

function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const fetchReviews = async () => {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setLoading(false); return; }
    const { data } = await supabase
      .from("appointment_reviews")
      .select("*, customers(name, phone), barbers(name), appointments(start_time, services(name))")
      .eq("tenant_id", user.user.id)
      .order("created_at", { ascending: false });
    setReviews(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  const moderate = async (id: string, action: "approve" | "reject" | "hide") => {
    const { data: user } = await supabase.auth.getUser();
    const update: any = action === "approve"
      ? { testimonial_status: "approved", show_on_frontend: true, approved_at: new Date().toISOString(), approved_by: user.user?.id }
      : action === "reject"
        ? { testimonial_status: "rejected", show_on_frontend: false }
        : { show_on_frontend: false };
    const { error } = await supabase.from("appointment_reviews").update(update).eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success(action === "approve" ? "Aprovado!" : action === "reject" ? "Rejeitado" : "Ocultado");
      fetchReviews();
    }
  };

  const filtered = reviews.filter(r =>
    filter === "all" ? true :
    filter === "pending" ? r.testimonial_status === "pending" :
    filter === "approved" ? r.testimonial_status === "approved" :
    r.testimonial_status === "rejected"
  );

  const counts = {
    pending: reviews.filter(r => r.testimonial_status === "pending").length,
    approved: reviews.filter(r => r.testimonial_status === "approved").length,
    rejected: reviews.filter(r => r.testimonial_status === "rejected").length,
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-[#D4AF37]" />
            Avaliações e Depoimentos
          </h1>
          <p className="text-muted-foreground mt-1">Modere as avaliações dos seus clientes antes de exibi-las no site.</p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Aprovados ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados ({counts.rejected})</TabsTrigger>
            <TabsTrigger value="all">Todos ({reviews.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4 space-y-3">
            {loading && <p className="text-muted-foreground">Carregando...</p>}
            {!loading && filtered.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma avaliação.</CardContent></Card>
            )}
            {filtered.map((r) => (
              <Card key={r.id} className="border-[#D4AF37]/10">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-base">{r.customers?.name || "Cliente"}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.appointments?.services?.name} • {r.barbers?.name}
                        {r.appointments?.start_time && ` • ${format(parseISO(r.appointments.start_time), "dd/MM/yyyy", { locale: ptBR })}`}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        r.testimonial_status === "approved" && "border-emerald-500/40 text-emerald-500",
                        r.testimonial_status === "pending" && "border-amber-500/40 text-amber-500",
                        r.testimonial_status === "rejected" && "border-red-500/40 text-red-500"
                      )}
                    >
                      {r.testimonial_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Barbearia</p>
                      <StarsDisplay value={r.barbershop_rating} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Barbeiro</p>
                      <StarsDisplay value={r.barber_rating} />
                    </div>
                  </div>
                  {r.testimonial_text && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border italic">
                      "{r.testimonial_text}"
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {r.testimonial_status !== "approved" && r.testimonial_text && (
                      <Button size="sm" onClick={() => moderate(r.id, "approve")} className="bg-emerald-600 hover:bg-emerald-700">
                        <Check className="h-4 w-4 mr-1" /> Aprovar para o site
                      </Button>
                    )}
                    {r.testimonial_status !== "rejected" && r.testimonial_text && (
                      <Button size="sm" variant="outline" onClick={() => moderate(r.id, "reject")} className="border-red-500/40 text-red-500 hover:bg-red-500/10">
                        <XIcon className="h-4 w-4 mr-1" /> Rejeitar
                      </Button>
                    )}
                    {r.show_on_frontend && (
                      <Button size="sm" variant="ghost" onClick={() => moderate(r.id, "hide")}>
                        <EyeOff className="h-4 w-4 mr-1" /> Ocultar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
