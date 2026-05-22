import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  X, 
  Play, 
  Rocket, 
  ChevronRight, 
  CheckCircle2,
  Sparkles,
  Loader2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { VideoPlayer } from "@/components/tutorials/VideoPlayer";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  const { data: settings } = useQuery({
    queryKey: ["onboarding-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_settings")
        .select("*")
        .eq("is_active", true)
        .single();
      if (error) return null;
      return data;
    }
  });

  const { data: preferences, isLoading: prefsLoading } = useQuery({
    queryKey: ["user-onboarding-prefs", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_onboarding_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) return null;
      return data;
    },
    enabled: !!user
  });

  useEffect(() => {
    if (!prefsLoading && settings && (!preferences || preferences.show_onboarding)) {
      setIsOpen(true);
    }
  }, [prefsLoading, settings, preferences]);

  const updatePrefsMutation = useMutation({
    mutationFn: async (show: boolean) => {
      if (!user) return;
      const { error } = await supabase
        .from("user_onboarding_preferences")
        .upsert({
          user_id: user.id,
          show_onboarding: show,
          last_seen_at: new Date().toISOString()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-onboarding-prefs", user?.id] });
    }
  });

  const handleClose = () => {
    if (dontShowAgain) {
      updatePrefsMutation.mutate(false);
    }
    setIsOpen(false);
  };

  if (!settings) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl p-0 bg-black/95 border-white/10 text-white overflow-hidden shadow-[0_0_100px_rgba(168,85,247,0.2)]">
        <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
          {/* Left Side: Content & Video */}
          <div className="flex-1 p-6 md:p-10 flex flex-col justify-between space-y-8 overflow-y-auto">
            <div className="space-y-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold uppercase tracking-widest"
              >
                <Sparkles size={14} /> Boas-vindas ao Barbex
              </motion.div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-none bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                VAMOS COMEÇAR SUA <br />JORNADA DE SUCESSO?
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                {settings.message || "Assista ao vídeo abaixo para aprender os primeiros passos e configurar sua barbearia em poucos minutos."}
              </p>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <VideoPlayer url={settings.video_url || "https://www.youtube.com/watch?v=dQw4w9WgXcQ"} />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-white/10">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="dontShow" 
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
                  className="border-white/20 data-[state=checked]:bg-primary"
                />
                <label 
                  htmlFor="dontShow" 
                  className="text-sm font-medium leading-none text-gray-400 cursor-pointer select-none"
                >
                  Não exibir este vídeo novamente
                </label>
              </div>
              <div className="flex gap-4 w-full sm:w-auto">
                <Button variant="ghost" onClick={handleClose} className="flex-1 sm:flex-none text-gray-400 hover:text-white">
                  Fechar
                </Button>
                <Button 
                  className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 transition-all shadow-lg shadow-purple-500/20"
                  onClick={handleClose}
                  asChild
                >
                  <Link to="/tutorials">
                    Ir para Tutoriais <ChevronRight size={18} className="ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Right Side: Quick Tips (Desktop) */}
          <div className="hidden md:flex w-72 bg-white/5 border-l border-white/10 p-8 flex-col justify-center space-y-8">
            <h4 className="font-bold text-sm uppercase tracking-widest text-primary flex items-center gap-2">
              <Rocket size={16} /> Checklist Rápido
            </h4>
            <div className="space-y-6">
              {[
                "Cadastre seus Barbeiros",
                "Configure seus Serviços",
                "Defina seu Horário",
                "Personalize seu Link"
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-1 h-5 w-5 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={12} />
                  </div>
                  <span className="text-sm text-gray-300 font-medium">{item}</span>
                </div>
              ))}
            </div>
            
            <div className="pt-8 mt-8 border-t border-white/10">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Dica Premium</p>
                <p className="text-xs text-gray-400 italic leading-relaxed">
                  "O segredo está nos detalhes. Use o cashback para fidelizar seus clientes!"
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
