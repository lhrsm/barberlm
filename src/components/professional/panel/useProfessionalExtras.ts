import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Carrega, de forma lazy e somente leitura, dados auxiliares do profissional
 * (avaliações e vendas de produtos). Falhas de RLS são tratadas silenciosamente
 * para nunca quebrar o painel.
 */
export function useProfessionalExtras(barberId?: string, enabled = true) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barberId || !enabled) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rev, sales] = await Promise.all([
          supabase
            .from("appointment_reviews")
            .select("id, barber_rating, service_rating, testimonial_text, reply, reply_at, created_at, submitted_at")
            .eq("barber_id", barberId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("product_sales")
            .select("id, total_amount, items, status, created_at")
            .eq("barber_id", barberId)
            .order("created_at", { ascending: false })
            .limit(200),
        ]);
        if (cancelled) return;
        setReviews(rev.data || []);
        setProductSales((sales.data || []).filter((s: any) => s.status !== "cancelled" && s.status !== "refunded"));
      } catch {
        if (!cancelled) {
          setReviews([]);
          setProductSales([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barberId, enabled]);

  return { reviews, productSales, loading };
}
