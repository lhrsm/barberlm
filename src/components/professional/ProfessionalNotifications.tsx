import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bell, 
  CheckCircle2, 
  Calendar, 
  Info,
  Check,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ProfessionalNotifications({ barberId }: { barberId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!barberId) return;
    fetchNotifications();

    const channel = supabase
      .channel(`prof-notifications-${barberId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `barber_id=eq.${barberId}`
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barberId]);

  async function fetchNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("barber_id", barberId)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read && !n.read).length);
    }
  }

  const markAsRead = async (id?: string) => {
    const query = supabase.from("notifications").update({ is_read: true, read: true });
    if (id) {
      await query.eq("id", id);
    } else {
      await query.eq("barber_id", barberId);
    }
    fetchNotifications();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'appointment': return <Calendar className="h-4 w-4 text-[#D4AF37]" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <Info className="h-4 w-4 text-[#D4AF37]/50" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative h-10 w-10 rounded-full border-[#D4AF37]/30 bg-[#05070d] text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37] transition-all"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 border-2 border-[#05070d] font-black text-[9px] text-white shadow-lg animate-pulse">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-[#0b0f17] border-[#D4AF37]/20 rounded-2xl shadow-2xl overflow-hidden text-white" align="end">
        <div className="flex items-center justify-between p-4 border-b border-[#D4AF37]/10 bg-[#0b0f17]">
          <h4 className="font-black text-xs uppercase tracking-widest text-[#D4AF37]">Notificações</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); markAsRead(); }} 
              className="text-[10px] h-7 font-black text-[#D4AF37] hover:bg-[#D4AF37]/10 uppercase tracking-tighter"
            >
              Marcar lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[350px] bg-[#0b0f17]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Bell className="h-10 w-10 text-gray-800 mb-3 opacity-20" />
              <p className="text-gray-600 text-xs font-medium italic">Tudo limpo por aqui.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id} 
                className={cn(
                  "p-4 border-b border-white/5 last:border-0 transition-colors cursor-pointer relative group",
                  (!n.is_read && !n.read) ? "bg-[#D4AF37]/5" : "hover:bg-white/5"
                )}
                onClick={() => markAsRead(n.id)}
              >
                <div className="flex gap-4">
                  <div className="mt-1 shrink-0">{getIcon(n.type)}</div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className={cn(
                      "text-sm leading-none truncate",
                      (!n.is_read && !n.read) ? "text-white font-black" : "text-gray-400 font-bold"
                    )}>{n.title}</p>
                    <p className="text-xs text-gray-500 leading-tight line-clamp-2 font-medium">{n.message}</p>
                    <p className="text-[9px] text-[#D4AF37]/70 font-black uppercase tracking-widest pt-1 flex items-center gap-2">
                      <Check className="h-2 w-2" />
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {(!n.is_read && !n.read) && (
                    <div className="h-2 w-2 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.6)] mt-2" />
                  )}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-3 bg-[#05070d]/50 text-center border-t border-white/5">
             <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Painel de Alertas em Tempo Real</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
