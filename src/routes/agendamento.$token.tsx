
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import React, { useEffect, useState } from "react";
...
function AppointmentManagementPage() {
  const { token } = Route.useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const expectedTenantId = searchParams.get('tenant');
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchAppointment();
    }
  }, [token]);

  async function fetchAppointment() {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_appointment_by_management_token', {
        p_token: token
      });

      if (rpcError) throw rpcError;
      
      if (!data || data.length === 0) {
        setError("Agendamento não encontrado ou link expirado.");
        return;
      }

      setAppointment(data[0]);
    } catch (err: any) {
      console.error("Error fetching appointment:", err);
      setError("Erro ao carregar agendamento. Verifique o link e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <XCircle className="text-red-500 w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter italic">Ops! Algo deu errado</h1>
        <p className="text-zinc-400 mb-8 max-w-xs">{error}</p>
        <Button variant="outline" className="border-zinc-800 text-zinc-400" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const isConfirmed = appointment.status === 'confirmed' || appointment.status === 'scheduled';
  const isCancelled = appointment.status === 'cancelled';
  const isCompleted = appointment.status === 'completed';

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10 mt-6">
          <h1 className="text-3xl font-black text-primary uppercase italic tracking-tighter mb-1">
            {appointment.business_name}
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Gerenciamento de Agendamento</p>
        </div>

        <Card className="bg-[#0b0f17] border border-zinc-800/50 rounded-[2.5rem] shadow-2xl overflow-hidden mb-6">
          <div className={cn(
            "p-6 flex items-center justify-center gap-3",
            isConfirmed ? "bg-emerald-500/10" : (isCancelled ? "bg-red-500/10" : "bg-primary/10")
          )}>
            {isConfirmed ? (
              <>
                <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                <span className="text-emerald-500 font-black uppercase text-xs tracking-widest">Seu agendamento já está confirmado.</span>
              </>
            ) : isCancelled ? (
              <>
                <XCircle className="text-red-500 w-5 h-5" />
                <span className="text-red-500 font-black uppercase text-xs tracking-widest">Agendamento Cancelado</span>
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle2 className="text-primary w-5 h-5" />
                <span className="text-primary font-black uppercase text-xs tracking-widest">Atendimento Finalizado</span>
              </>
            ) : (
              <>
                <AlertCircle className="text-primary w-5 h-5" />
                <span className="text-primary font-black uppercase text-xs tracking-widest">{appointment.status}</span>
              </>
            )}
          </div>

          <CardContent className="p-8 space-y-8">
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Olá,</span>
              <h2 className="text-2xl font-black tracking-tight">{appointment.customer_name}</h2>
            </div>

            <div className="grid gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Scissors className="text-primary w-5 h-5" />
                </div>
                <div>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Serviço</p>
                  <p className="font-bold text-white leading-tight">{appointment.service_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <User className="text-primary w-5 h-5" />
                </div>
                <div>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Profissional</p>
                  <p className="font-bold text-white leading-tight">{appointment.professional_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Calendar className="text-primary w-5 h-5" />
                </div>
                <div>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Data</p>
                  <p className="font-bold text-white leading-tight">
                    {format(parseISO(appointment.start_time), "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="text-primary w-5 h-5" />
                </div>
                <div>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Horário</p>
                  <p className="font-bold text-white leading-tight">
                    {format(parseISO(appointment.start_time), "HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800/50">
              <p className="text-center text-zinc-500 text-xs italic">
                Em breve você poderá reagendar ou cancelar seu horário diretamente por aqui.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <Button 
            className="h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest shadow-xl shadow-primary/20"
            asChild
          >
            <a href={`https://wa.me/${appointment.business_phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
              Falar com a Barbearia
            </a>
          </Button>
          
          <Button 
            variant="ghost" 
            className="text-zinc-500 hover:text-white hover:bg-white/5 font-bold"
            onClick={() => window.print()}
          >
            Salvar Comprovante
          </Button>
        </div>

        <p className="text-center mt-12 text-zinc-700 text-[10px] font-bold uppercase tracking-widest">
          Powered by Barbex
        </p>
      </motion.div>
    </div>
  );
}
