import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  tenantId: string;
  onSubmitted?: () => void;
}

function StarRow({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
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
              n <= value ? "text-[#D4AF37]" : "text-gray-600"
            )}
            aria-label={`${n} estrelas`}
          >
            <Star className={cn("h-8 w-8", n <= value && "fill-[#D4AF37]")} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewModal({ open, onOpenChange, appointment, tenantId, onSubmitted }: ReviewModalProps) {
  const [shopRating, setShopRating] = useState(5);
  const [barberRating, setBarberRating] = useState(5);
  const [testimonial, setTestimonial] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!appointment) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("appointment_reviews").insert({
        tenant_id: tenantId,
        appointment_id: appointment.id,
        customer_id: appointment.customer_id,
        barber_id: appointment.barber_id,
        barbershop_rating: shopRating,
        barber_rating: barberRating,
        testimonial_text: testimonial.trim() || null,
        testimonial_status: "pending",
        show_on_frontend: false,
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("Você já avaliou este atendimento.");
        } else throw error;
      } else {
        toast.success("Obrigado pela sua avaliação!");
        onOpenChange(false);
        setTestimonial("");
        setShopRating(5);
        setBarberRating(5);
        onSubmitted?.();
      }
    } catch (e: any) {
      toast.error("Erro ao enviar avaliação: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0f17] border-[#D4AF37]/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-[#D4AF37] uppercase tracking-wider">
            Como foi sua experiência?
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Sua avaliação ajuda a melhorar nosso atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <StarRow value={shopRating} onChange={setShopRating} label="Avaliação da Barbearia" />
          <StarRow value={barberRating} onChange={setBarberRating} label="Avaliação do Barbeiro" />
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
              Depoimentos passam por aprovação antes de aparecerem no site.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#D4AF37] hover:bg-[#B8962E] text-black font-black"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Enviando..." : "Enviar Avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
