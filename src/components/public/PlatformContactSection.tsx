import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  Sparkles,
  Building,
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { normalizePhone } from "@/utils/phone";
import {
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  LinkedIn,
  TikTok
} from "@/components/ui/social-icons";
import {
  submitPlatformContactMessage,
  PlatformPublicSettings
} from "@/lib/platform-contact.functions";

interface PlatformContactSectionProps {
  settings?: PlatformPublicSettings | null;
}

const SUBJECT_OPTIONS = [
  "Quero conhecer o Barbex",
  "Planos e preços",
  "Implantação",
  "Suporte comercial",
  "Parceria",
  "Migração de sistema",
  "Dúvida",
  "Outro",
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
    case "linkedin":
      return clean.startsWith("company/") || clean.startsWith("in/")
        ? `https://linkedin.com/${clean}`
        : `https://linkedin.com/company/${clean}`;
    case "youtube":
      return clean.startsWith("channel/") || clean.startsWith("c/") || clean.startsWith("@")
        ? `https://youtube.com/${clean}`
        : `https://youtube.com/@${clean}`;
    case "twitter":
      return `https://x.com/${clean}`;
    default:
      return `https://${clean}`;
  }
}

export function PlatformContactSection({ settings }: PlatformContactSectionProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const hasContactForm = Boolean(settings?.has_contact_form);
  const whatsappNumber = settings?.whatsapp_number ? normalizePhone(settings.whatsapp_number) : "";
  const publicEmail = settings?.public_email || "";
  const directPhone = settings?.phone || "";
  const address = settings?.address || "";
  const socialLinks = settings?.social_links || {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || name.trim().length < 2) {
      toast.error("Por favor informe seu nome (mínimo 2 caracteres).");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Por favor informe um e-mail válido.");
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      toast.error("A mensagem deve ter pelo menos 5 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitPlatformContactMessage({
        data: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          company: company.trim(),
          subject: subject.trim(),
          message: message.trim(),
          honeypot: honeypot.trim(),
        },
      });

      if (response?.success) {
        setIsSuccess(true);
        toast.success("Mensagem enviada com sucesso! Nossa equipe entrará em contato.");
        setName("");
        setEmail("");
        setPhone("");
        setCompany("");
        setMessage("");
        setSubject(SUBJECT_OPTIONS[0]);
      }
    } catch (error: any) {
      console.error("[PlatformContact] Submission error:", error);
      toast.error(error.message || "Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contato" className="py-24 md:py-32 px-6 relative overflow-hidden bg-gradient-to-b from-[#05070d] via-[#090d16] to-[#04060a]">
      {/* Background Decorative Ambient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(245,158,11,0.06),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(245,158,11,0.04),transparent_50%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-gold/20 bg-gold/5 text-gold text-[10px] font-black uppercase tracking-widest"
          >
            <Sparkles size={12} />
            Atendimento Institucional
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white"
          >
            Fale com o <span className="text-gold">Barbex</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto font-medium"
          >
            Quer saber mais sobre a plataforma, planos Enterprise ou implantação? Envie uma mensagem para nossa equipe de especialistas.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Contact Area / Form */}
          <div className={hasContactForm ? "lg:col-span-7" : "lg:col-span-8 lg:col-start-3"}>
            {hasContactForm ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-8 md:p-10 rounded-[2.5rem] border border-white/10 bg-zinc-950/80 backdrop-blur-xl shadow-2xl relative overflow-hidden"
              >
                {isSuccess ? (
                  <div className="py-12 text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 text-gold flex items-center justify-center mx-auto">
                      <CheckCircle2 size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black uppercase italic text-white tracking-tight">Mensagem Enviada!</h3>
                      <p className="text-slate-400 text-sm max-w-md mx-auto">
                        Agradecemos seu contato. Nossa equipe técnica e comercial retornará o mais breve possível.
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsSuccess(false)}
                      variant="outline"
                      className="rounded-xl border-white/20 text-white hover:bg-white/10 text-xs font-bold uppercase tracking-wider"
                    >
                      Enviar Nova Mensagem
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Honeypot Bot Trap Field (Hidden from real users) */}
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="bot_trap_field">Não preencha se for humano:</label>
                      <input
                        type="text"
                        id="bot_trap_field"
                        name="bot_trap_field"
                        tabIndex={-1}
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        autoComplete="off"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="contact-name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Seu Nome <span className="text-gold">*</span>
                        </Label>
                        <Input
                          id="contact-name"
                          placeholder="Ex: João Carlos"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          disabled={isSubmitting}
                          className="h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-gold/50 focus:ring-gold/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact-email" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          E-mail de Contato <span className="text-gold">*</span>
                        </Label>
                        <Input
                          id="contact-email"
                          type="email"
                          placeholder="seuemail@empresa.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isSubmitting}
                          className="h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-gold/50 focus:ring-gold/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="contact-phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          WhatsApp / Telefone
                        </Label>
                        <Input
                          id="contact-phone"
                          placeholder="(00) 00000-0000"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={isSubmitting}
                          className="h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-gold/50 focus:ring-gold/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact-company" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Barbearia / Empresa
                        </Label>
                        <Input
                          id="contact-company"
                          placeholder="Nome da sua barbearia"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          disabled={isSubmitting}
                          className="h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-gold/50 focus:ring-gold/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-subject" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Assunto <span className="text-gold">*</span>
                      </Label>
                      <select
                        id="contact-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full h-12 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-gold/50 focus:outline-none"
                      >
                        {SUBJECT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt} className="bg-zinc-900 text-white">
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="contact-message" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Mensagem <span className="text-gold">*</span>
                        </Label>
                        <span className="text-[9px] font-mono text-slate-500">
                          {message.length}/1000
                        </span>
                      </div>
                      <Textarea
                        id="contact-message"
                        placeholder="Como podemos te ajudar hoje?"
                        rows={4}
                        maxLength={1000}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        disabled={isSubmitting}
                        className="bg-white/5 border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-gold/50 focus:ring-gold/20 resize-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-14 rounded-2xl bg-gold text-black font-black uppercase tracking-widest text-xs hover:bg-gold/90 shadow-lg shadow-gold/20 gap-2 transition-all"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Enviando Mensagem...</span>
                        </div>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Enviar Mensagem</span>
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-8 md:p-12 rounded-[2.5rem] border border-white/10 bg-zinc-950/80 backdrop-blur-xl text-center space-y-6"
              >
                <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 text-gold flex items-center justify-center mx-auto">
                  <MessageSquare size={28} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase italic text-white tracking-tight">Atendimento Direto Barbex</h3>
                  <p className="text-slate-400 text-sm max-w-lg mx-auto">
                    Entre em contato diretamente com nossa equipe comercial e de suporte através dos nossos canais oficiais abaixo.
                  </p>
                </div>

                {whatsappNumber && (
                  <div className="pt-2">
                    <Button
                      asChild
                      className="h-14 px-8 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-black uppercase tracking-widest text-xs shadow-lg shadow-[#25D366]/20 gap-2"
                    >
                      <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                        <MessageSquare size={18} />
                        Conversar no WhatsApp
                      </a>
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Right Direct Channels & Social Info */}
          <div className={hasContactForm ? "lg:col-span-5 space-y-6" : "hidden"}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-[2.5rem] border border-white/10 bg-zinc-950/60 backdrop-blur-md space-y-6"
            >
              <h4 className="text-base font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                <ShieldCheck className="text-gold w-5 h-5" />
                Canais Oficiais
              </h4>

              <div className="space-y-4 text-sm">
                {whatsappNumber && (
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-gold/30 hover:bg-white/[0.06] transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0">
                      <MessageSquare size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">WhatsApp Oficial</div>
                      <div className="text-white font-bold truncate">Falar com especialista</div>
                    </div>
                    <ArrowUpRight size={16} className="text-slate-600 group-hover:text-gold transition-colors shrink-0" />
                  </a>
                )}

                {publicEmail && (
                  <a
                    href={`mailto:${publicEmail}`}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-gold/30 hover:bg-white/[0.06] transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <Mail size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">E-mail Institucional</div>
                      <div className="text-white font-bold truncate">{publicEmail}</div>
                    </div>
                    <ArrowUpRight size={16} className="text-slate-600 group-hover:text-gold transition-colors shrink-0" />
                  </a>
                )}

                {directPhone && (
                  <a
                    href={`tel:${directPhone.replace(/\D/g, "")}`}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-gold/30 hover:bg-white/[0.06] transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <Phone size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Telefone</div>
                      <div className="text-white font-bold truncate">{directPhone}</div>
                    </div>
                    <ArrowUpRight size={16} className="text-slate-600 group-hover:text-gold transition-colors shrink-0" />
                  </a>
                )}

                {address && (
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-gold flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sede</div>
                      <div className="text-slate-300 text-xs leading-relaxed font-medium">{address}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Social Media Badges */}
              {Object.keys(socialLinks).some((k) => Boolean(socialLinks[k as keyof typeof socialLinks])) && (
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Siga o Barbex nas redes
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {socialLinks.instagram && (
                      <a
                        href={formatSocialUrl("instagram", socialLinks.instagram)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Instagram Barbex"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-gold/30 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-gold transition-all"
                      >
                        <Instagram size={18} />
                      </a>
                    )}
                    {socialLinks.facebook && (
                      <a
                        href={formatSocialUrl("facebook", socialLinks.facebook)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Facebook Barbex"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-gold/30 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-gold transition-all"
                      >
                        <Facebook size={18} />
                      </a>
                    )}
                    {socialLinks.tiktok && (
                      <a
                        href={formatSocialUrl("tiktok", socialLinks.tiktok)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="TikTok Barbex"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-gold/30 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-gold transition-all"
                      >
                        <TikTok size={18} />
                      </a>
                    )}
                    {socialLinks.linkedin && (
                      <a
                        href={formatSocialUrl("linkedin", socialLinks.linkedin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="LinkedIn Barbex"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-gold/30 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-gold transition-all"
                      >
                        <LinkedIn size={18} />
                      </a>
                    )}
                    {socialLinks.youtube && (
                      <a
                        href={formatSocialUrl("youtube", socialLinks.youtube)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="YouTube Barbex"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-gold/30 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-gold transition-all"
                      >
                        <Youtube size={18} />
                      </a>
                    )}
                    {socialLinks.twitter && (
                      <a
                        href={formatSocialUrl("twitter", socialLinks.twitter)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="X / Twitter Barbex"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-gold/30 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-gold transition-all"
                      >
                        <Twitter size={18} />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
