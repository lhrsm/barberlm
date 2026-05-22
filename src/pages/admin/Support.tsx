import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  Filter, 
  MessageSquare, 
  Clock, 
  AlertCircle,
  MoreVertical,
  ChevronRight,
  LifeBuoy
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { SuperAdminTicketDetails } from "@/components/admin/support/SuperAdminTicketDetails";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SuperAdminSupport() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-all-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          barbershops (
            name,
            slug
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-tickets-realtime')
      .on('postgres_changes', { 
        event: '*', 
        table: 'support_tickets',
        schema: 'public'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-all-tickets"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredTickets = tickets?.filter(ticket => 
    (ticket.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    ticket.barbershops?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ticket.id?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge className="bg-blue-500 hover:bg-blue-600">Aberto</Badge>;
      case 'in_progress': return <Badge className="bg-amber-500 hover:bg-amber-600">Em andamento</Badge>;
      case 'responded': return <Badge className="bg-purple-500 hover:bg-purple-600">Respondido</Badge>;
      case 'resolved': return <Badge className="bg-green-500 hover:bg-green-600">Resolvido</Badge>;
      case 'closed': return <Badge variant="secondary">Fechado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive" className="animate-pulse">Alta</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 border-amber-500/30">Média</Badge>;
      case 'low': return <Badge variant="outline">Baixa</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <LifeBuoy className="text-primary h-8 w-8" /> Central de Suporte Global
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie todos os chamados das barbearias parceiras em tempo real.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="py-4">
            <CardDescription className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Total de Chamados</CardDescription>
            <CardTitle className="text-2xl font-black">{tickets?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="py-4">
            <CardDescription className="text-xs uppercase font-bold tracking-widest text-blue-500">Abertos</CardDescription>
            <CardTitle className="text-2xl font-black text-blue-500">{tickets?.filter(t => t.status === 'open').length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="py-4">
            <CardDescription className="text-xs uppercase font-bold tracking-widest text-amber-500">Em Andamento</CardDescription>
            <CardTitle className="text-2xl font-black text-amber-500">{tickets?.filter(t => t.status === 'in_progress').length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="py-4">
            <CardDescription className="text-xs uppercase font-bold tracking-widest text-green-500">Resolvidos</CardDescription>
            <CardTitle className="text-2xl font-black text-green-500">{tickets?.filter(t => t.status === 'resolved' || t.status === 'closed').length || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-md overflow-hidden">
        <CardHeader className="p-6 border-b border-border/50">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Buscar por título, ID ou barbearia..." 
                className="pl-10 bg-background/50 border-border/50 focus-visible:ring-primary/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 border-border/50">
                <Filter size={14} /> Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[100px] font-bold text-xs uppercase text-muted-foreground px-6 py-4">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-muted-foreground py-4">Assunto / Barbearia</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-muted-foreground py-4">Prioridade</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-muted-foreground py-4">Categoria</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-muted-foreground py-4 text-right pr-6">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell colSpan={5} className="h-16 bg-muted/10"></TableCell>
                    </TableRow>
                  ))
                ) : filteredTickets?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-muted-foreground italic">
                      Nenhum chamado encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets?.map((ticket) => (
                    <TableRow 
                      key={ticket.id} 
                      className="cursor-pointer hover:bg-primary/5 transition-colors group border-border/50"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setIsSheetOpen(true);
                      }}
                    >
                      <TableCell className="px-6 py-4">
                        {getStatusBadge(ticket.status)}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors">{ticket.title}</span>
                          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                            {ticket.barbershops?.name || 'Barbearia Desconhecida'} 
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-border/30">#{ticket.id.split('-')[0]}</Badge>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {getPriorityBadge(ticket.priority)}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="secondary" className="font-medium">{ticket.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-foreground">
                            {ticket.created_at ? format(new Date(ticket.created_at), "dd 'de' MMM", { locale: ptBR }) : '-'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {ticket.created_at ? format(new Date(ticket.created_at), "HH:mm") : '-'}
                          </span>
                        </div>
                      </TableCell>

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 border-l border-border/50 shadow-2xl overflow-hidden">
          {selectedTicket && (
            <SuperAdminTicketDetails 
              ticket={selectedTicket} 
              onClose={() => setIsSheetOpen(false)} 
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
