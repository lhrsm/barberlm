import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, MessageSquare, Phone, CheckCircle2, Mail, MapPin } from "lucide-react";
import { submitPublicContactMessage } from "@/lib/contact.functions";
import { normalizePhone } from "@/utils/phone";

interface PublicContactSectionProps {
  shop: any;
  slug: string;
}

const SUBJECT_OPTIONS = [
  "Dúvida Geral",
  "Agendamento e Horários",
  "Serviços e Valores",
  "Produtos e Cuidados",
  "Clube Barbex / Assinatura",
  "Programa de Fidelidade",
  "Elogio ou Sugestão",
  "Reclamação",
  "Parcerias e Eventos",
  "Outro Assunto",
];

function formatSocialUrl(platform: string, rawValue?: string): string {
  if (!rawValue || typeof rawValue !== "string") return "";
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const clean = trimmed.replace(/^@/, "");
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "facebook":
      return `https://facebook.com/${clean}`;
    case "tiktok":
      return `https://tiktok.com/@${clean}`;
    case "youtube":
      return clean.startsWith("channel/") || clean.startsWith("c/") ? `https://youtube.com/${clean}` : `https://youtube.com/@${clean}`;
    default:
      return `https://${clean}`;
  }
}

export function PublicContactSection({ shop, slug }: PublicContactSectionProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("Dúvida Geral");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const businessName = shop?.business_name || "Barbearia";
  const rawWhatsapp = shop?.whatsapp_number || (shop?.social_links as any)?.whatsapp;
  const cleanWhatsapp = rawWhatsapp ? normalizePhone(rawWhatsapp) : "";
  const whatsappUrl = cleanWhatsapp
    ? `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(`Olá! Vim pelo site da ${businessName} e gostaria de tirar uma dúvida.`)}`
    : "";

  const social = (shop as any)?.social_links || {};
  const socials = [
    { key: "instagram", url: formatSocialUrl("instagram", social.instagram), label: "Instagram", icon: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM17.5 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" },
    { key: "facebook", url: formatSocialUrl("facebook", social.facebook), label: "Facebook", icon: "M13 22v-8h3l1-4h-4V7.5C13 6.4 13.4 5.5 15 5.5h2V2.2C16.5 2.1 15.3 2 14 2c-3 0-5 1.8-5 5v3H6v4h3v8h4z" },
    { key: "tiktok", url: formatSocialUrl("tiktok", social.tiktok), label: "TikTok", icon: "M16 2c.3 1.7 1.3 3 2.8 3.8 1 .5 2 .7 3.2.7v3.6c-2 .1-3.8-.4-5.5-1.5v6.6c0 4-3.3 7.3-7.3 7.3S2 18.7 2 14.7s3.3-7.3 7.3-7.3c.4 0 .8 0 1.2.1v3.8c-.4-.1-.8-.2-1.2-.2-2 0-3.7 1.7-3.7 3.7s1.7 3.7 3.7 3.7 3.7-1.7 3.7-3.7V2h3z" },
    { key: "youtube", url: formatSocialUrl("youtube", social.youtube), label: "YouTube", icon: "M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8C22 15.2 22 12 22 12s0-3.2-.4-4.8zM10 15V9l5 3-5 3z" },
  ].filter((s) => s.url && s.url.length > 0);

  const hasAddress = !!shop?.address;

  // Determine if explicit contact_email is configured
  const hasContactEmail = Boolean(
    shop?.contact_email &&
    typeof shop.contact_email === "string" &&
    shop.contact_email.trim().length > 0 &&
    shop.contact_email.includes("@")
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Por favor, preencha o seu nome.");
      return;
    }

    if (!email.trim() && !phone.trim()) {
      toast.error("Por favor, informe pelo menos um meio de retorno (E-mail ou WhatsApp/Telefone).");
      return;
    }

    if (!message.trim()) {
      toast.error("Por favor, digite sua mensagem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitPublicContactMessage({
        data: {
          slug,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          subject,
          message: message.trim(),
          honeypot: honeypot || undefined,
        }
      });

      if (res?.success) {
        toast.success(res.message || "Mensagem enviada com sucesso! A barbearia entrará em contato com você.");
        setName("");
        setEmail("");
        setPhone("");
        setSubject("Dúvida Geral");
        setMessage("");
        setIsSubmitted(true);
      } else {
        toast.error("Não foi possível enviar sua mensagem. Tente novamente.");
      }
    } catch (err: any) {
      console.error("[PublicContactSection] Error submitting contact form:", err);
      toast.error(err.message || "Não foi possível enviar sua mensagem. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="contato"
      className="relative py-20 px-4 sm:px-6 lg:px-8 border-t border-[#F5C542]/10 overflow-hidden"
      style={{
        background: "radial-gradient(circle at 50% 0%, rgba(245,197,66,0.06), transparent 50%), #03060E",
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header da Seção */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/25 text-gold text-xs font-black uppercase tracking-[0.2em]">
            <MessageSquare size={14} /> Atendimento Direto
          </div>
          <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
            Fale com a <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5C542] via-[#E6B800] to-[#D4A017]">{businessName}</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            {hasContactEmail
              ? "Tem alguma dúvida, sugestão ou precisa de um horário especial? Envie sua mensagem e nossa equipe retornará rapidamente."
              : "Entre em contato conosco diretamente através dos nossos canais de atendimento."}
          </p>
        </div>

        {hasContactEmail ? (
          /* Layout Completo com Formulário de E-mail */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Formulário Principal */}
            <div className="lg:col-span-7 bg-[#080D1A]/90 border border-gold/15 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              {isSubmitted ? (
                <div className="py-12 text-center space-y-5">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">Mensagem Enviada com Sucesso!</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                      Agradecemos seu contato. A equipe da <strong className="text-white">{businessName}</strong> responderá em breve.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsSubmitted(false)}
                    variant="outline"
                    className="mt-4 rounded-full border-gold/30 text-gold hover:bg-gold hover:text-black font-bold text-xs uppercase tracking-wider"
                  >
                    Enviar Outra Mensagem
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Honeypot anti-spam invisível */}
                  <input
                    type="text"
                    name="bot_trap_field"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  <div className="space-y-2">
                    <Label htmlFor="contact-name" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Seu Nome <span className="text-gold">*</span>
                    </Label>
                    <Input
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Carlos Eduardo"
                      required
                      maxLength={100}
                      className="bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-gold focus:ring-gold/20 h-11 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-email" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Seu E-mail
                      </Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="carlos@exemplo.com"
                        maxLength={100}
                        className="bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-gold focus:ring-gold/20 h-11 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-phone" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        WhatsApp / Telefone
                      </Label>
                      <Input
                        id="contact-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        maxLength={20}
                        className="bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-gold focus:ring-gold/20 h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    * Informe pelo menos um meio de contato (E-mail ou WhatsApp) para podermos responder.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="contact-subject" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Assunto
                    </Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger id="contact-subject" className="bg-black/40 border-white/10 text-white focus:border-gold focus:ring-gold/20 h-11 rounded-xl">
                        <SelectValue placeholder="Selecione um assunto" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#05070d] border-gold/20 text-white">
                        {SUBJECT_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt} className="cursor-pointer focus:bg-gold/10 focus:text-gold">
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="contact-message" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Sua Mensagem <span className="text-gold">*</span>
                      </Label>
                      <span className="text-[11px] text-slate-500">{message.length}/1000</span>
                    </div>
                    <Textarea
                      id="contact-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={`Como a ${businessName} pode te ajudar hoje?`}
                      required
                      maxLength={1000}
                      rows={4}
                      className="bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-gold focus:ring-gold/20 rounded-xl resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-full font-black uppercase tracking-wider text-black bg-gradient-to-r from-[#F5C542] via-[#E6B800] to-[#D4A017] hover:from-[#F8D265] hover:to-[#D4A017] shadow-[0_10px_25px_rgba(245,197,66,0.3)] transition-all hover:-translate-y-0.5"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando Mensagem...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" /> Enviar Mensagem
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* Cartão Lateral de Canais Diretos */}
            <div className="lg:col-span-5 space-y-6">
              {/* Bloco WhatsApp Direto */}
              {whatsappUrl && (
                <div className="bg-gradient-to-br from-emerald-950/40 via-[#080D1A] to-[#080D1A] border border-emerald-500/20 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Phone size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base">Atendimento Rápido</h4>
                      <p className="text-xs text-slate-400">Fale direto com a equipe</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Prefere conversar em tempo real? Chame diretamente no WhatsApp oficial da barbearia.
                  </p>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Falar no WhatsApp da ${businessName}`}
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-all hover:-translate-y-0.5"
                  >
                    <MessageSquare size={16} /> Falar no WhatsApp
                  </a>
                </div>
              )}

              {/* Redes Sociais */}
              {socials.length > 0 && (
                <div className="bg-[#080D1A]/90 border border-gold/15 rounded-3xl p-6 shadow-xl space-y-4">
                  <h4 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-gold animate-pulse" /> Siga nossas redes
                  </h4>
                  <p className="text-xs text-slate-400">
                    Acompanhe cortes, novidades, bastidores e promoções exclusivas da {businessName}.
                  </p>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {socials.map((s) => (
                      <a
                        key={s.key}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${s.label} da ${businessName}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:text-gold hover:border-gold/50 hover:bg-gold/5 transition-all"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={s.icon} /></svg>
                        {s.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Informações da Unidade */}
              <div className="bg-[#080D1A]/60 border border-white/5 rounded-3xl p-6 text-xs text-slate-400 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Mail size={14} className="text-gold" /> Resposta Garantida
                </div>
                <p className="leading-relaxed">
                  Mensagens enviadas pelo formulário são entregues com segurança diretamente à administração da barbearia.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Layout Elegante sem Formulário (quando contact_email não está configurado) */
          <div className="max-w-2xl mx-auto bg-[#080D1A]/90 border border-gold/15 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl space-y-6 text-center">
            <p className="text-sm text-slate-300">
              Entre em contato conosco através dos nossos canais de atendimento disponíveis abaixo:
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Falar no WhatsApp da ${businessName}`}
                  className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-all w-full sm:w-auto"
                >
                  <MessageSquare size={16} /> Falar no WhatsApp
                </a>
              )}
            </div>

            {hasAddress && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
                <MapPin size={14} className="text-gold shrink-0" />
                <span>{shop.address}</span>
              </div>
            )}

            {socials.length > 0 && (
              <div className="pt-4 border-t border-white/10">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-3">Nossas Redes Sociais</span>
                <div className="flex flex-wrap justify-center gap-2.5">
                  {socials.map((s) => (
                    <a
                      key={s.key}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${s.label} da ${businessName}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:text-gold hover:border-gold/50 hover:bg-gold/5 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={s.icon} /></svg>
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
