import { useState } from "react";
import { 
  LogOut, 
  AlertCircle 
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function LogoutButton() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      // 1. Supabase SignOut
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // 2. Clear caches and storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all react-query cache (handled by the reload or by auth provider usually, but we force it)
      window.location.href = "/auth";
      
      toast.success("Logoff realizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao sair: " + error.message);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 px-4 py-3 text-sm font-medium transition-all duration-300 rounded-lg group hover:bg-destructive/10 hover:text-destructive hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] text-muted-foreground"
        >
          <LogOut size={20} className="transition-transform group-hover:-translate-x-1" />
          <span>Sair do Painel</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-[#0A0A0A] border-white/10 backdrop-blur-xl shadow-2xl max-w-[400px]">
        <AlertDialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive mb-4 mx-auto">
            <AlertCircle size={24} />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-center text-white">Deseja realmente sair?</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-muted-foreground pt-2">
            Sua sessão será encerrada com segurança e você precisará se autenticar novamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex gap-2">
          <AlertDialogCancel className="flex-1 bg-white/5 hover:bg-white/10 border-white/10 text-white transition-all">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleLogout}
            className="flex-1 bg-destructive hover:bg-destructive/90 text-white border-none shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all"
          >
            Sair agora
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
