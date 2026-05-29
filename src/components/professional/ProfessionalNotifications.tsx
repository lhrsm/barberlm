import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bell, 
  CheckCircle2, 
  Calendar, 
  Info,
  Check
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
    fetchNotifications();

    const channel = supabase
      .channel('prof-notifications')
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
      default: return <Info className="h-4 w-4 text-[#6B7280]" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative h-10 w-10 rounded-full border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 border-2 border-white font-bold text-[10px] text-white">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white border-[#D4AF37] rounded-2xl shadow-xl overflow-hidden" align="end">
        <div className="flex items-center justify-between p-4 border-b border-[#D4AF37]/10 bg-white">
          <h4 className="font-bold text-[#111827]">Notificações</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAsRead()} 
              className="text-[10px] h-7 font-bold text-[#D4AF37] hover:bg-[#D4AF37]/5"
            >
              Ler todas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px] bg-white">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-[#6B7280] text-sm italic">
              Nenhuma notificação por enquanto.
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id} 
                className={cn(
                  "p-4 border-b border-[#D4AF37]/5 last:border-0 hover:bg-[#D4AF37]/5 transition-colors cursor-pointer relative",
                  (!n.is_read && !n.read) && "bg-[#D4AF37]/5"
                )}
                onClick={() => markAsRead(n.id)}
              >
                <div className="flex gap-3">
                  <div className="mt-1">{getIcon(n.type)}</div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-bold leading-none text-[#111827]">{n.title}</p>
                    <p className="text-xs text-[#6B7280] leading-tight">{n.message}</p>
                    <p className="text-[10px] text-[#D4AF37] font-medium pt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {(!n.is_read && !n.read) && <div className="h-2 w-2 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.6)]" />}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
