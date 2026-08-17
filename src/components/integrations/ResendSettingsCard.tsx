import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Mail, 
  ShieldCheck, 
  Settings2, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  History,
  PlayCircle,
  ExternalLink,
  Globe,
  Lock,
  Loader2
} from "lucide-react";
import { 
  getResendSettings, 
  updateResendSettings, 
  validateResendIntegration 
} from "@/lib/resend-settings.functions";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";

interface ResendSettingsCardProps {
  emailLogs?: any[];
  onRefreshLogs?: () => void;
}

export function ResendSettingsCard({ emailLogs = [], onRefreshLogs }: ResendSettingsCardProps) {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [settings, setSettings] = useState<any>(null);
  const [secrets, setSecrets] = useState({ hasApiKey: false, hasWebhookSecret: false });
  
  const [formData, setFormData] = useState({
    from_name: "",
    from_email: "",
    domain: ""
  });

  const getSettingsFn = useServerFn(getResendSettings);
  const updateSettingsFn = useServerFn(updateResendSettings);
  const validateFn = useServerFn(validateResendIntegration);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSettingsFn();
      setSettings(data.settings);
      setSecrets(data.secrets);
      setFormData({
        from_name: data.settings.from_name,
        from_email: data.settings.from_email,
        domain: data.settings.domain
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar configurações do Resend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      await updateSettingsFn({ data: formData });
      toast.success("Configurações salvas com sucesso!");
      setIsConfigModalOpen(false);
      fetchSettings();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    try {
      setIsValidating(true);
      const result = await validateFn();
      if (result.success) {
        toast.success("Integração validada com a Resend API!");
        fetchSettings();
      } else {
        toast.error(`Erro na validação: ${result.error}`);
      }
    } catch (error) {
      toast.error("Erro ao validar integração");
    } finally {
      setIsValidating(false);
    }
  };

  const isConfigured = secrets.hasApiKey && settings?.domain;

  if (loading) {
    return (
      <Card className="bg-[#0b0f17] border-zinc-800 animate-pulse">
        <div className="h-64" />
      </Card>
    );
  }

  return (
    <>
      <Card className="flex flex-col bg-[#0b0f17] border border-zinc-800/80 text-white rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(16,185,129,0.06)] hover:border-gold/30 transition-all">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-500/30 grid place-items-center">
              <Mail size={20} className="text-sky-400" />
            </div>
            <Badge className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-none",
              isConfigured ? (settings?.is_domain_verified ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400") : "bg-zinc-500/10 text-zinc-400"
            )}>
              {isConfigured ? (settings?.is_domain_verified ? "Conectado" : "Pendente Verificação") : "Não Configurado"}
            </Badge>
          </div>
          <CardTitle className="text-lg mt-4 text-white">Resend Enterprise</CardTitle>
          <CardDescription className="text-zinc-400">Canal global de e-mails transacionais do Barbex.</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Domínio</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{settings?.domain || "---"}</span>
                {settings?.is_domain_verified ? (
                  <CheckCircle2 size={12} className="text-emerald-400" />
                ) : (
                  <AlertCircle size={12} className="text-amber-400" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Remetente</span>
              <span className="font-bold text-white truncate max-w-[180px]">{settings?.from_email || "---"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">API Key</span>
              {secrets.hasApiKey ? (
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[9px] font-bold">CONFIGURADA</Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[9px] font-bold">PENDENTE</Badge>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Webhook Secret</span>
              {secrets.hasWebhookSecret ? (
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[9px] font-bold">CONFIGURADO</Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[9px] font-bold">PENDENTE</Badge>
              )}
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <History size={12} /> Últimos Envios
            </h4>
            <div className="space-y-2">
              {emailLogs.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">Nenhum envio registrado recentemente.</p>
              ) : (
                emailLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-black/20 text-[10px]">
                    <span className="text-zinc-400 truncate max-w-[120px]">{log.recipient}</span>
                    <Badge variant="outline" className={cn(
                      "h-5 text-[8px] font-black uppercase border-none",
                      log.status === 'delivered' ? "text-emerald-400 bg-emerald-500/5" : "text-amber-400 bg-amber-500/5"
                    )}>
                      {log.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="border-t border-zinc-800/80 pt-4 gap-2">
          <Button 
            onClick={() => setIsConfigModalOpen(true)}
            size="sm" 
            className="h-8 px-3 text-xs rounded-lg bg-zinc-800 text-white font-black uppercase tracking-widest hover:bg-zinc-700"
          >
            <Settings2 size={14} className="mr-1.5" /> Configurar
          </Button>
          
          <Button 
            onClick={handleValidate}
            disabled={isValidating || !secrets.hasApiKey}
            variant="outline"
            size="sm" 
            className="h-8 px-3 text-xs rounded-lg border-zinc-800 text-zinc-400 hover:text-white"
          >
            {isValidating ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} className="mr-1.5" />} 
            Validar
          </Button>

          {isConfigured && (
            <Button 
              onClick={() => setIsTestModalOpen(true)}
              size="sm" 
              className="h-8 px-3 text-xs rounded-lg bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 ml-auto"
            >
              <PlayCircle size={14} className="mr-1.5" /> Testar
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Modal de Configuração */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#0b0f17] border border-gold/20 rounded-[2rem] p-8 space-y-6 shadow-[0_0_50px_rgba(212,175,55,0.1)]">
            <div className="text-center space-y-2">
              <Mail className="w-12 h-12 text-gold mx-auto mb-2" />
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Configuração Global Resend</h3>
              <p className="text-zinc-400 text-sm">Defina as credenciais e parâmetros de e-mail do SaaS.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome do Remetente</Label>
                <Input 
                  value={formData.from_name} 
                  onChange={(e) => setFormData({...formData, from_name: e.target.value})} 
                  placeholder="Ex: Barbex"
                  className="h-12 rounded-xl bg-[#05070d] border-zinc-800 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Domínio</Label>
                <Input 
                  value={formData.domain} 
                  onChange={(e) => setFormData({...formData, domain: e.target.value})} 
                  placeholder="notify.barbex.shop"
                  className="h-12 rounded-xl bg-[#05070d] border-zinc-800 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">E-mail Remetente</Label>
              <Input 
                value={formData.from_email} 
                onChange={(e) => setFormData({...formData, from_email: e.target.value})} 
                placeholder="noreply@notify.barbex.shop"
                className="h-12 rounded-xl bg-[#05070d] border-zinc-800 text-white"
              />
            </div>

            <div className="bg-black/40 border border-zinc-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 grid place-items-center">
                    <Lock size={18} className="text-gold" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Secrets de Segurança</h4>
                    <p className="text-[10px] text-zinc-500">As chaves sensíveis são geridas pelo Barbex Cloud.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  className="h-10 border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-800 justify-between px-4"
                  onClick={() => toast.info("Use o mecanismo de Secrets do Lovable para configurar RESEND_API_KEY")}
                >
                  <span className="text-xs font-bold uppercase tracking-wider">RESEND_API_KEY</span>
                  {secrets.hasApiKey ? <CheckCircle2 size={16} className="text-emerald-500" /> : <span className="text-[9px] text-amber-500 font-black">PENDENTE</span>}
                </Button>

                <Button 
                  variant="outline" 
                  className="h-10 border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-800 justify-between px-4"
                  onClick={() => toast.info("Use o mecanismo de Secrets do Lovable para configurar RESEND_WEBHOOK_SECRET")}
                >
                  <span className="text-xs font-bold uppercase tracking-wider">WEBHOOK_SECRET</span>
                  {secrets.hasWebhookSecret ? <CheckCircle2 size={16} className="text-emerald-500" /> : <span className="text-[9px] text-amber-500 font-black">OPCIONAL</span>}
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="ghost" 
                onClick={() => setIsConfigModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-zinc-400"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="flex-1 h-12 rounded-xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : "Salvar Configuração"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Teste */}
      {isTestModalOpen && (
        <TestModal 
          isOpen={isTestModalOpen}
          onClose={() => setIsTestModalOpen(false)}
          settings={settings}
          onRefreshLogs={onRefreshLogs}
        />
      )}
    </>
  );
}

function TestModal({ isOpen, onClose, settings, onRefreshLogs }: { 
  isOpen: boolean, 
  onClose: () => void, 
  settings: any, 
  onRefreshLogs?: () => void 
}) {
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; messageId?: string; error?: string } | null>(null);

  const handleTestSend = async () => {
    if (!testEmail) return;
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const { sendTransactionalEmail } = await import("@/lib/resend.functions");
      const result = await sendTransactionalEmail({
        data: {
          recipient: testEmail,
          templateKey: 'test_email'
        }
      });
      
      setTestResult({ success: true, messageId: result.messageId });
      toast.success("E-mail de teste enviado com sucesso!");
      onRefreshLogs?.();
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
      toast.error("Falha ao enviar e-mail de teste");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0b0f17] border border-gold/20 rounded-[2rem] p-8 space-y-6 shadow-[0_0_50px_rgba(212,175,55,0.1)]">
        <div className="text-center space-y-2">
          <Mail className="w-12 h-12 text-gold mx-auto mb-4" />
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Enviar E-mail de Teste</h3>
          <p className="text-zinc-400 text-sm">Valide a configuração real de envio transacional.</p>
        </div>
        
        <div className="space-y-4">
          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
              <span>Remetente</span>
              <Badge variant="outline" className="h-4 border-emerald-500/20 text-emerald-400 text-[8px] uppercase">{settings?.domain}</Badge>
            </div>
            <div className="text-xs font-bold text-white truncate">{settings?.from_name} &lt;{settings?.from_email}&gt;</div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">E-mail Destinatário</Label>
            <Input 
              type="email" 
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="exemplo@email.com"
              className="h-12 rounded-xl bg-[#05070d] border-zinc-800 text-white"
            />
          </div>

          {testResult && (
            <div className={cn(
              "p-4 rounded-xl border text-[10px] space-y-1",
              testResult.success ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-400"
            )}>
              <div className="font-black uppercase tracking-wider">
                {testResult.success ? "Sucesso" : "Falha"}
              </div>
              <div className="break-all opacity-80">
                {testResult.success 
                  ? `ID: ${testResult.messageId}` 
                  : `Erro: ${testResult.error}`
                }
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="flex-1 h-12 rounded-xl text-zinc-400"
            disabled={isTesting}
          >
            Fechar
          </Button>
          <Button 
            onClick={handleTestSend}
            disabled={isTesting || !testEmail}
            className="flex-1 h-12 rounded-xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90"
          >
            {isTesting ? <Loader2 size={16} className="animate-spin" /> : "Enviar Teste"}
          </Button>
        </div>
      </div>
    </div>
  );
}
