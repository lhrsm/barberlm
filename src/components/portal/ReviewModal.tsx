import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Send, CheckCircle2, Scissors, User as UserIcon, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { emitAutomationEvent } from "@/utils/emit-event";

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  tenantId: string;
  onSubmitted?: () => void;
}

function StarRow({ value, onChange, label, disabled }: { value: number; onChange: (v: number) => void; label: string; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-white">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(n)}
            className={cn(
              "p-1 transition-transform",
              !disabled && "hover:scale-110",
              n <= value ? "text-gold" : "text-gray-600",
              disabled && "cursor-default"
            )}
            aria-label={`${n} estrelas`}
          >
            <Star className={cn("h-8 w-8", n <= value && "fill-gold")} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewModal({ open, onOpenChange, appointment, tenantId, onSubmitted }: ReviewModalProps) {
  const [shopRating, setShopRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [barberRating, setBarberRating] = useState(5);
  const [testimonial, setTestimonial] = useState("");
  const [allowPublic, setAllowPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    if (!open || !appointment?.id) return;
    setLoadingExisting(true);
    (async () => {
      const { data } = await supabase.rpc("get_customer_review", { _appointment_id: appointment.id });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setExisting(row);
        setShopRating(row.barbershop_rating ?? 5);
        setServiceRating(row.service_rating ?? 5);
        setBarberRating(row.barber_rating ?? 5);
        setTestimonial(row.testimonial_text ?? "");
        setAllowPublic(!!row.allow_public_display);
      } else {
        setExisting(null);
      }
      setLoadingExisting(false);
    })();
  }, [open, appointment?.id]);

  if (!appointment) return null;

  const isApproved = existing?.testimonial_status === "approved";
  const readOnly = isApproved;

  const handleSubmit = async () => {
    if (appointment.review_decision === "skipped") {
      toast.info("Você optou por não avaliar este atendimento.");
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tenant_id: tenantId,
        appointment_id: appointment.id,
        customer_id: appointment.customer_id,
        barber_id: appointment.barber_id,
        service_id: appointment.service_id ?? appointment.services?.id ?? null,
        barbershop_rating: shopRating,
        service_rating: serviceRating,
        barber_rating: barberRating,
        testimonial_text: testimonial.trim() || null,
        testimonial_status: "pending",
        allow_public_display: allowPublic,
        show_on_frontend: false,
        submitted_at: new Date().toISOString(),
      };

      let error;
      if (existing?.id) {
        ({ error } = await supabase.from("appointment_reviews").update(payload).eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("appointment_reviews").insert(payload));
      }

      if (error) {
        if (error.code === "23505") {
          toast.error("Você já avaliou este atendimento.");
        } else if (error.message?.includes("review_decision_already_skipped")) {
          toast.info("Você optou por não avaliar este atendimento.");
          onOpenChange(false);
        } else throw error;
      } else {
        toast.success(existing?.id ? "Avaliação atualizada!" : "Obrigado pela sua avaliação!");
        // Fire intelligent review automations
        const avg = (shopRating + serviceRating + barberRating) / 3;
        const evt = avg >= 5 ? "review.excellent" : avg <= 2 ? "review.bad" : "review.received";
        emitAutomationEvent({
          tenantId,
          event: evt as any,
          appointmentId: appointment.id,
          customerId: appointment.customer_id,
          extra: {
            avg_rating: avg.toFixed(1),
            shop_rating: shopRating,
            barber_rating: barberRating,
            service_rating: serviceRating,
            testimonial: testimonial || "",
            allow_public_display: allowPublic,
          },
        });
        onOpenChange(false);
        onSubmitted?.();
      }
    } catch (e: any) {
      toast.error("Erro ao enviar avaliação: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const svcName = appointment.services?.name || appointment.service?.name;
  const barberName = appointment.barbers?.name || appointment.barber?.name;
  const startTime = appointment.start_time || appointment.appointment_date;
  const dateStr = startTime ? format(typeof startTime === "string" ? parseISO(startTime) : startTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0f17] border-gold/20 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold uppercase tracking-wider flex items-center gap-2">
            {isApproved && <CheckCircle2 className="h-5 w-5" />}
            {isApproved ? "Sua Avaliação" : existing ? "Editar Avaliação" : "Como foi sua experiência?"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {isApproved
              ? "Esta avaliação já foi aprovada e não pode mais ser editada."
              : "Sua avaliação ajuda a melhorar nosso atendimento."}
          </DialogDescription>
        </DialogHeader>

        {/* Contexto do atendimento */}
        <div className="rounded-xl border border-gold/15 bg-[#05070d] p-3 space-y-1.5 text-xs">
          {svcName && (
            <div className="flex items-center gap-2 text-gray-300">
              <Scissors className="h-3.5 w-3.5 text-gold/70" />
              <span className="font-semibold">{svcName}</span>
            </div>
          )}
          {barberName && (
            <div className="flex items-center gap-2 text-gray-300">
              <UserIcon className="h-3.5 w-3.5 text-gold/70" />
              <span className="font-semibold">{barberName}</span>
            </div>
          )}
          {dateStr && (
            <div className="flex items-center gap-2 text-gray-300">
              <CalendarIcon className="h-3.5 w-3.5 text-gold/70" />
              <span className="font-semibold">{dateStr}</span>
            </div>
          )}
        </div>

        {loadingExisting ? (
          <div className="py-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : (
          <div className="space-y-5 py-2">
            <StarRow value={shopRating} onChange={setShopRating} label="Avaliação da Barbearia" disabled={readOnly} />
            <StarRow value={serviceRating} onChange={setServiceRating} label="Avaliação do Serviço" disabled={readOnly} />
            <StarRow value={barberRating} onChange={setBarberRating} label="Avaliação do Barbeiro" disabled={readOnly} />
            <div className="space-y-2">
              <p className="text-sm font-bold text-white">Depoimento (opcional)</p>
              <Textarea
                value={testimonial}
                onChange={(e) => setTestimonial(e.target.value)}
                placeholder="Conte sua experiência..."
                className="bg-[#05070d] border-gold/20 text-white min-h-[100px]"
                maxLength={500}
                readOnly={readOnly}
              />
            </div>
            {!readOnly && (
              <label className="flex items-start gap-3 rounded-xl border border-gold/15 bg-[#05070d] p-3 cursor-pointer hover:border-gold/30 transition">
                <input
                  type="checkbox"
                  checked={allowPublic}
                  onChange={(e) => setAllowPublic(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-gold cursor-pointer"
                />
                <span className="text-xs text-gray-300 leading-relaxed">
                  Autorizo a barbearia a exibir publicamente minha avaliação (nome, nota e depoimento) no site.
                </span>
              </label>
            )}
            <p className="text-[10px] text-gray-500">
              Avaliações passam por aprovação da barbearia antes de aparecerem publicamente.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly && (
            <Button
              onClick={handleSubmit}
              disabled={submitting || loadingExisting}
              className="bg-gold hover:bg-[#B8962E] text-black font-black"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Enviando..." : existing ? "Atualizar Avaliação" : "Enviar Avaliação"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
