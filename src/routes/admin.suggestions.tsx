import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Lightbulb, Trash2, MessageSquare } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SuperAdminTicketDetails } from "@/components/admin/support/SuperAdminTicketDetails";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/suggestions")({
  component: AdminSuggestions,
});

function AdminSuggestions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["admin-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`*, barbershops (name, slug)`)
        .eq("category", "Sugestões")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-suggestions-realtime")
      .on("postgres_changes", { event: "*", table: "support_tickets", schema: "public" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filtered = suggestions?.filter(t =>
    (t.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    t.barbershops?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir esta sugestão?")) return;
    const { error } = await supabase.from("support_tickets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sugestão excluída");
    queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] });
  };

  const total = suggestions?.length || 0;
  const open = suggestions?.filter(t => t.status === "open").length || 0;
  const resolved = suggestions?.filter(t => t.status === "resolved" || t.status === "closed").length || 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <Lightbulb className="text-amber-400 h-8 w-8" /> Sugestões dos Clientes
        </h1>
        <p className="text-muted-foreground mt-1">Ideias e melhorias enviadas pelas barbearias parceiras.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="py-4">
            <CardDescription className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Total</CardDescription>
            <CardTitle className="text-2xl font-black">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="py-4">
            <CardDescription className="text-xs uppercase font-bold tracking-widest text-blue-500">Pendentes</CardDescription>
            <CardTitle className="text-2xl font-black text-blue-500">{open}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="py-4">
            <CardDescription className="text-xs uppercase font-bold tracking-widest text-green-500">Analisadas</CardDescription>
            <CardTitle className="text-2xl font-black text-green-500">{resolved}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-md overflow-hidden">
        <CardHeader className="p-6 border-b border-border/50">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por título ou barbearia..."
              className="pl-10 bg-background/50 border-border/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="font-bold text-xs uppercase text-muted-foreground py-4 px-6">Sugestão / Barbearia</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-muted-foreground py-4">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-muted-foreground py-4 text-right pr-6">Data</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : !filtered?.length ? (
                  <TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">
                    <Lightbulb className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhuma sugestão recebida ainda.
                  </TableCell></TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-amber-500/5 transition-colors group border-border/50"
                      onClick={() => { setSelectedTicket(t); setIsOpen(true); }}
                    >
                      <TableCell className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground group-hover:text-amber-400 transition-colors flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5" /> {t.title}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {t.barbershops?.name || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="capitalize">{t.status || "open"}</Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4 text-xs text-muted-foreground">
                        {t.created_at ? format(new Date(t.created_at), "dd MMM · HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="py-4">
                        <Button variant="ghost" size="icon" onClick={(e) => handleDelete(t.id, e)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[800px] w-[95vw] h-[85vh] p-0 border-white/10 bg-[#0A0A0A] overflow-hidden flex flex-col">
          {selectedTicket && (
            <SuperAdminTicketDetails ticket={selectedTicket} onClose={() => setIsOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
