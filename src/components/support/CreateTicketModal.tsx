import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  "Financeiro",
  "Agendamentos",
  "WhatsApp",
  "Erros",
  "Pagamentos",
  "Sugestões",
  "Outros",
];

const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [form, setForm] = useState({
    title: "",
    category: "",
    priority: "medium",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Você precisa estar logado para abrir um chamado.");
      return;
    }

    if (!tenantId) {
      toast.error("Erro ao identificar a barbearia. Tente recarregar a página.");
      return;
    }

    if (!form.title || !form.category || !form.description) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("Iniciando abertura de ticket...");
      
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          title: form.title,
          description: form.description,
          category: form.category,
          priority: form.priority,
          status: 'open',
          user_id: user.id,
          barbershop_id: tenantId
        })
        .select();

      if (error) {
        console.error("Erro no Supabase:", error);
        toast.error(error.message);
        return;
      }

      console.log("Ticket criado com sucesso:", data);
      toast.success("Chamado aberto com sucesso!");
      onSuccess();
      onClose();
      
      // Reset form
      setForm({
        title: "",
        category: "",
        priority: "medium",
        description: "",
      });

    } catch (error: any) {
      console.error("Erro inesperado:", error);
      toast.error(error.message || "Ocorreu um erro ao abrir o chamado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#0c0c0c] border-white/10 text-white shadow-2xl shadow-primary/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Novo Chamado
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Preencha os dados abaixo para abrir um ticket de suporte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Título</label>
            <Input
              placeholder="Ex: Problema no login"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:ring-primary/50"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Categoria</label>
              <Select 
                value={form.category} 
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Prioridade</label>
              <Select 
                value={form.priority} 
                onValueChange={(value) => setForm({ ...form, priority: value })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Descrição</label>
            <Textarea
              placeholder="Descreva detalhadamente sua dúvida ou problema..."
              className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:ring-primary/50 resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-white px-8 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Abrindo...
                </>
              ) : (
                "Abrir Chamado"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
