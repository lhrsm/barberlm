import { useState, useEffect, useId } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bell, 
  Check, 
  Clock, 
  ExternalLink,
  MessageCircle,
  CreditCard,
  AlertTriangle,
  LifeBuoy
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

export function AdminNotifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("admin_notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-notifications-realtime')
      .on('postgres_changes', { 
        event: '*', 
        table: 'admin_notifications',
        schema: 'public'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_ticket': return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'ticket_reply': return <LifeBuoy className="h-4 w-4 text-purple-500" />;
      case 'new_subscriber': return <CreditCard className="h-4 w-4 text-green-500" />;
      case 'payment_approved': return <Check className="h-4 w-4 text-green-500" />;
      case 'payment_failed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }

    if (notification.type === 'new_ticket' || notification.type === 'ticket_reply') {
      navigate({ to: "/admin/support" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group overflow-visible">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Bell className={cn(
            "h-5 w-5 transition-all duration-300",
            unreadCount > 0 
              ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-[pulse_2s_infinite]" 
              : "text-muted-foreground group-hover:text-white"
          )} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF0000] text-[10px] font-black text-white ring-2 ring-[#0A0A0A] shadow-[0_0_10px_rgba(255,0,0,0.5)] animate-bounce">
              {unreadCount}
            </span>
          )}
          <div className="absolute -inset-2 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-85 p-0 bg-[#0A0A0A]/95 border-white/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
        <div className="flex items-center justify-between p-4 border-b">
          <DropdownMenuLabel className="p-0 font-bold text-base">Notificações</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando notificações...</div>
          ) : notifications?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground italic">Nenhuma notificação por enquanto.</div>
          ) : (
            <div className="flex flex-col">
              {notifications?.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    "flex flex-col gap-1 p-4 text-left transition-colors border-b last:border-0 hover:bg-accent/50 group relative",
                    !notification.is_read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {!notification.is_read && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
                  )}
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-full bg-background border shadow-sm">
                        {getIcon(notification.type)}
                      </div>
                      <span className="font-semibold text-sm line-clamp-1">{notification.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {notification.description}
                  </p>
                  <div className="mt-2 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                      Visualizar <ExternalLink size={10} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <Button variant="ghost" className="w-full text-xs font-medium h-8" onClick={() => navigate({ to: "/admin/dashboard" })}>
            Ver todas as atividades
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
