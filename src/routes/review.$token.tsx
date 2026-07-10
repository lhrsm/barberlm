import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/review/$token")({
  component: PublicReviewPage,
  head: () => ({
    meta: [
      { title: "Avaliar Atendimento | Barbex" },
      { name: "description", content: "Compartilhe sua experiência com nossa barbearia." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function StarRow({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-white">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "p-1 transition-transform hover:scale-110",
              n <= value ? "text-[#D4AF37]" : "text-gray-600",
            )}
            aria-label={`${n} estrelas`}
          >
            <Star className={cn("h-9 w-9", n <= value && "fill-[#D4AF37]")} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PublicReviewPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [shopRating, setShopRating] = useState(5);
  const [barberRating, setBarberRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [testimonial, setTestimonial] = useState("");
  const [recommend, setRecommend] = useState<"yes" | "maybe" | "no">("yes");
  const [allowPublic, setAllowPublic] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: res, error: e } = await supabase.rpc("get_review_by_token", { _token: token });
      if (e) {
        setError("Não foi possível carregar a avaliação.");
      } else if (!res) {
        setError("invalid");
      } else {
        setData(res);
        if ((res as any).already_submitted) setSubmitted(true);
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { error: e } = await supabase.rpc("submit_review_by_token", {
        _token: token,
        _barbershop_rating: shopRating,
        _barber_rating: barberRating,
        _service_rating: serviceRating,
        _testimonial_text: testimonial,
        _would_recommend: recommend,
        _allow_public_display: allowPublic,
        _service_id: (data as any)?.service_id ?? null,
      });
      if (e) {
        if (e.message?.includes("invalid_or_expired_token")) {
          toast.error("Link inválido ou expirado.");
        } else {
          toast.error("Erro ao enviar: " + e.message);
        }
      } else {
        setSubmitted(true);
        toast.success("Obrigado pela sua avaliação!");
      }
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070d] grid place-items-center text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (error === "invalid" || !data) {
    return (
      <div className="min-h-screen bg-[#05070d] grid place-items-center p-6 text-white">
        <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
          <XCircle className="h-14 w-14 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-black mb-2">Link inválido</h1>
          <p className="text-gray-400 text-sm">Este link de avaliação não é válido ou expirou.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#05070d] grid place-items-center p-6 text-white">
        <div className="max-w-md w-full rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-[#D4AF37] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2 text-[#D4AF37]">Avaliação enviada</h1>
          <p className="text-gray-300 text-sm">
            Obrigado por avaliar sua experiência na{" "}
            <span className="font-bold">{data.barbershop_name}</span>.
          </p>
        </div>
      </div>
    );
  }

  const apptDate = data.appointment_date
    ? new Date(data.appointment_date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#05070d] py-8 px-4 text-white">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
            {data.barbershop_name}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black">Como foi seu atendimento?</h1>
          <p className="text-gray-400 text-sm">
            Olá {data.customer_name || "cliente"}, sua opinião é muito importante para nós.
          </p>
        </header>

        <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#0b0f17] p-5 space-y-1 text-sm">
          {data.service_name && (
            <p><span className="text-gray-500">Serviço:</span> <span className="font-bold">{data.service_name}</span></p>
          )}
          {data.barber_name && (
            <p><span className="text-gray-500">Barbeiro:</span> <span className="font-bold">{data.barber_name}</span></p>
          )}
          {apptDate && (
            <p><span className="text-gray-500">Data:</span> <span className="font-bold">{apptDate}</span></p>
          )}
        </div>

        <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#0b0f17] p-5 space-y-6">
          <StarRow value={shopRating} onChange={setShopRating} label="Avaliação da Barbearia" />
          <StarRow value={serviceRating} onChange={setServiceRating} label="Avaliação do Serviço" />
          <StarRow value={barberRating} onChange={setBarberRating} label="Avaliação do Barbeiro" />

          <div className="space-y-2">
            <p className="text-sm font-bold text-white">Você recomendaria para um amigo?</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "yes" as const, l: "Sim" },
                { v: "maybe" as const, l: "Talvez" },
                { v: "no" as const, l: "Não" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setRecommend(o.v)}
                  className={cn(
                    "rounded-xl border py-2.5 text-sm font-bold transition",
                    recommend === o.v
                      ? "bg-[#D4AF37] text-black border-[#D4AF37]"
                      : "bg-transparent text-gray-300 border-white/10 hover:border-[#D4AF37]/50",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-white">Depoimento (opcional)</p>
            <Textarea
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              placeholder="Conte sua experiência..."
              className="bg-[#05070d] border-[#D4AF37]/20 text-white min-h-[100px]"
              maxLength={500}
            />
            <p className="text-[10px] text-gray-500">
              Depoimentos passam por aprovação antes de aparecerem publicamente.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-[#D4AF37]/15 bg-[#05070d] p-3 cursor-pointer hover:border-[#D4AF37]/30 transition">
            <input
              type="checkbox"
              checked={allowPublic}
              onChange={(e) => setAllowPublic(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#D4AF37] cursor-pointer"
            />
            <span className="text-xs text-gray-300 leading-relaxed">
              Autorizo a barbearia a exibir publicamente minha avaliação (nome, nota e depoimento) no site.
            </span>
          </label>

            onClick={submit}
            disabled={submitting}
            className="w-full h-12 bg-[#D4AF37] hover:bg-[#B8962E] text-black font-black text-base"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Enviando..." : "Enviar Avaliação"}
          </Button>
        </div>
      </div>
    </div>
  );
}
