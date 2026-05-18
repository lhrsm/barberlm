import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Phone, Mail, Lock } from "lucide-react";

export function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            business_name: businessName,
          },
        },
      });

      if (error) throw error;

      toast.success(
        data.session
          ? "Conta criada com sucesso."
          : "Verifique seu e-mail para confirmar o cadastro."
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (loginMethod === "email") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        // Para login por telefone, geralmente usa-se OTP ou uma lógica customizada.
        // Como o usuário mencionou "o login dele pode ser via telefone cadastrado" para barbeiros,
        // vamos implementar a tentativa de login por telefone (E.164 format).
        // Nota: O Supabase exige que o telefone esteja confirmado para signInWithPassword se habilitado, 
        // ou usa-se signInWithOtp. Por padrão, vamos tentar o signInWithPassword se houver senha.
        
        // Se for um barbeiro e usarmos a senha padrão ou algo similar.
        // Mas a forma mais robusta no Supabase é OTP. 
        // No entanto, se o sistema usa senhas para todos:
        const { error } = await supabase.auth.signInWithPassword({
          phone: phone.startsWith('+') ? phone : `+55${phone.replace(/\D/g, '')}`,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciais inválidas" : error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Por favor, insira seu e-mail para recuperar a senha.");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });
      if (error) throw error;
      toast.success("E-mail de recuperação enviado com sucesso.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-card rounded-xl shadow-lg border">
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="signup">Cadastro</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
          <div className="flex justify-center gap-4 mb-6">
            <Button 
              variant={loginMethod === "email" ? "default" : "outline"} 
              size="sm" 
              className="gap-2"
              onClick={() => setLoginMethod("email")}
            >
              <Mail size={16} /> E-mail
            </Button>
            <Button 
              variant={loginMethod === "phone" ? "default" : "outline"} 
              size="sm" 
              className="gap-2"
              onClick={() => setLoginMethod("phone")}
            >
              <Phone size={16} /> Telefone
            </Button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginMethod === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    className="pl-10"
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="login-phone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-phone"
                    type="tel"
                    className="pl-10"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="login-password">Senha</Label>
                {loginMethod === "email" && (
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Nome da Barbearia</Label>
              <Input
                id="business-name"
                type="text"
                placeholder="Barbearia do João"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Senha</Label>
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Cadastrando..." : "Criar Conta"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

