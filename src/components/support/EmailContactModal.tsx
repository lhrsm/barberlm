import { useState } from "react";
import { z } from "zod";
import { Mail, Send, User, Phone, MessageSquare, AtSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const SUPPORT_EMAIL = "suporte@barbex.shop";

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(8, "Telefone inválido").max(30),
  assunto: z.string().trim().min(3, "Informe o assunto").max(150),
  mensagem: z.string().trim().min(5, "Escreva uma mensagem").max(2000),
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function EmailContactModal({ isOpen, onClose }: Props) {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    assunto: "",
    mensagem: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) fe[i.path[0] as string] = i.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});
    const { nome, email, telefone, assunto, mensagem } = parsed.data;
    const body = `Nome: ${nome}\nE-mail: ${email}\nTelefone: ${telefone}\n\n${mensagem}`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    toast.success("Abrindo seu cliente de e-mail...");
    setForm({ nome: "", email: "", telefone: "", assunto: "", mensagem: "" });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0A1020] border border-[rgba(255,184,0,0.15)] text-white p-0 overflow-hidden">
        <div className="p-6 border-b border-zinc-800/80 bg-gradient-to-br from-[#f59e0b]/10 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 grid place-items-center">
                <Mail className="h-5 w-5 text-[#f59e0b]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">
                  Enviar E-mail ao Suporte
                </DialogTitle>
                <DialogDescription className="text-zinc-400 text-[13px]">
                  Preencha o formulário e responderemos o quanto antes.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field
            id="nome"
            label="Nome"
            icon={<User className="h-4 w-4" />}
            value={form.nome}
            onChange={set("nome")}
            placeholder="Seu nome completo"
            error={errors.nome}
          />
          <Field
            id="email"
            label="E-mail"
            type="email"
            icon={<AtSign className="h-4 w-4" />}
            value={form.email}
            onChange={set("email")}
            placeholder="voce@exemplo.com"
            error={errors.email}
          />
          <Field
            id="telefone"
            label="Telefone"
            icon={<Phone className="h-4 w-4" />}
            value={form.telefone}
            onChange={set("telefone")}
            placeholder="(00) 00000-0000"
            error={errors.telefone}
          />
          <Field
            id="assunto"
            label="Assunto"
            icon={<MessageSquare className="h-4 w-4" />}
            value={form.assunto}
            onChange={set("assunto")}
            placeholder="Sobre o que deseja falar?"
            error={errors.assunto}
          />

          <div className="space-y-1.5">
            <Label htmlFor="mensagem" className="text-zinc-300 text-[13px] font-medium">
              Mensagem
            </Label>
            <Textarea
              id="mensagem"
              value={form.mensagem}
              onChange={set("mensagem")}
              placeholder="Descreva sua dúvida ou solicitação..."
              rows={4}
              className="bg-[#050816] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-[#f59e0b]/40 focus-visible:border-[#f59e0b]/50 resize-none"
            />
            {errors.mensagem && (
              <p className="text-[12px] text-red-400">{errors.mensagem}</p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 sm:h-10 rounded-xl border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-11 sm:h-10 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-semibold shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.45)] transition-all"
            >
              <Send className="h-4 w-4 mr-2" /> Enviar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  icon,
  error,
  type = "text",
  ...rest
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-zinc-300 text-[13px] font-medium">
        {label}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
          {icon}
        </span>
        <Input
          id={id}
          type={type}
          className="pl-9 bg-[#050816] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-[#f59e0b]/40 focus-visible:border-[#f59e0b]/50 h-11"
          {...rest}
        />
      </div>
      {error && <p className="text-[12px] text-red-400">{error}</p>}
    </div>
  );
}
