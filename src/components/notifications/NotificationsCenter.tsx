import { useState, useEffect, useId } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { 
  Bell, 
  Check, 
  Calendar,
  Clock, 
  ExternalLink,
  MessageCircle,
  CreditCard,
  AlertTriangle,
  X,
  User
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
import { toast } from "sonner";

export function NotificationsCenter() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const instanceId = useId().replace(/:/g, ""); // Remove colons for channel name compatibility
  
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId
  });

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  useEffect(() => {
    if (!tenantId) return;

    const channelName = `notifications-realtime-${tenantId}-${instanceId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        table: 'notifications',
        schema: 'public',
        filter: `tenant_id=eq.${tenantId}`
      }, (payload) => {
        console.log('REALTIME NOTIFICATION RECEIVED', payload);
        queryClient.invalidateQueries({ queryKey: ["notifications", tenantId] });
        
        // Show realtime toast
        toast("🔔 " + (payload.new.title || "Notificação"), {
          description: payload.new.message,
          action: {
            label: "Ver",
            onClick: () => navigate({ to: "/calendar" })
          }
        });
      })
      .on('postgres_changes', {
        event: '*',
        table: 'notifications',
        schema: 'public',
        filter: `tenant_id=eq.${tenantId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", tenantId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, navigate, instanceId, tenantId]);

  const getIcon = (type: string | null) => {
    switch (type) {
      case 'appointment_created': return <Calendar className="h-4 w-4 text-green-500" />;
      case 'appointment_cancelled': return <X className="h-4 w-4 text-red-500" />;
      case 'appointment_rescheduled': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'payment_received': return <CreditCard className="h-4 w-4 text-green-500" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    navigate({ to: "/calendar" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Notificações"
          variant="ghost"
          size="icon"
          className={cn(
            "relative group rounded-full h-10 w-10",
            "border border-gold/30 bg-gold/5",
            "hover:bg-gold/25 hover:border-gold/70 hover:scale-105",
            "hover:shadow-[0_0_24px_rgba(212,175,55,0.35)]",
            "hover:ring-2 hover:ring-gold/40",
            "transition-all duration-300 ease-out",
            "after:absolute after:inset-0 after:rounded-full",
            "after:opacity-0 group-hover:after:opacity-100",
            "after:bg-gradient-to-tr after:from-gold/10 after:via-white/20 after:to-transparent",
            "after:transition-opacity after:duration-300",
            unreadCount > 0 && "ring-2 ring-gold/40 shadow-[0_0_18px_rgba(212,175,55,0.25)]"
          )}
        >
          <Bell className={cn(
            "h-5 w-5 transition-all duration-300 relative z-10",
            unreadCount > 0 ? "text-gold animate-pulse" : "text-gold/60 group-hover:text-gold group-hover:drop-shadow-[0_0_6px_rgba(212,175,55,0.7)]"
          )} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-gold to-[#B8860B] text-[10px] font-black text-black ring-2 ring-background shadow-[0_2px_8px_rgba(212,175,55,0.5)]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <DropdownMenuLabel className="p-0 font-bold">Notificações</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs text-primary"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : notifications?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground italic">Sem notificações.</div>
          ) : (
            <div className="flex flex-col">
              {notifications?.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    "flex flex-col gap-1 p-4 text-left transition-colors border-b last:border-0 hover:bg-accent/50",
                    !notification.read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {getIcon(notification.type)}
                      <span className="font-semibold text-sm line-clamp-1">{notification.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {notification.created_at && formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {notification.message}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
