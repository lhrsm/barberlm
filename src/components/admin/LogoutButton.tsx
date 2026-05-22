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
          size="sm" 
          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle size={20} />
            <AlertDialogTitle>Deseja realmente sair?</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Sua sessão será encerrada e você precisará fazer login novamente para acessar o painel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-accent hover:bg-accent/80 border-none">Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleLogout}
            className="bg-destructive hover:bg-destructive/90 text-white border-none"
          >
            Sair agora
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
