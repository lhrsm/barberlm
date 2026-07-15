import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { History, CheckCircle2, TrendingUp, RefreshCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuditTrail } from "@/components/finances/AuditTrail";

type Props = {
  refundRequests: any[];
  loadingRefunds: boolean;
  refundStatusFilter: string;
  setRefundStatusFilter: (v: string) => void;
  refundDateStartFilter: string;
  setRefundDateStartFilter: (v: string) => void;
  refundDateEndFilter: string;
  setRefundDateEndFilter: (v: string) => void;
  refundSearchTerm: string;
  setRefundSearchTerm: (v: string) => void;
  handleUpdateRefundStatus: (refundId: string, newStatus: string, notes?: string) => void | Promise<void>;
};

export function RefundsTab({
  refundRequests,
  loadingRefunds,
  refundStatusFilter,
  setRefundStatusFilter,
  refundDateStartFilter,
  setRefundDateStartFilter,
  refundDateEndFilter,
  setRefundDateEndFilter,
  refundSearchTerm,
  setRefundSearchTerm,
  handleUpdateRefundStatus,
}: Props) {
  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-zinc-900/40 border-zinc-800/50 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-500">
              <History className="h-6 w-6" />
            </div>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 font-bold uppercase text-[10px]">
              Pendente
            </Badge>
          </div>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Estornos Solicitados</p>
          <h3 className="text-3xl font-black text-white">R$ 0.00</h3>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/50 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold uppercase text-[10px]">
              Pago
            </Badge>
          </div>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Estornos Pagos</p>
          <h3 className="text-3xl font-black text-white">R$ 0.00</h3>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/50 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
              <TrendingUp className="h-6 w-6" />
            </div>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 font-bold uppercase text-[10px]">
              Créditos
            </Badge>
          </div>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Créditos Concedidos</p>
          <h3 className="text-3xl font-black text-white">R$ 0.00</h3>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl">
        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</Label>
          <Select value={refundStatusFilter} onValueChange={setRefundStatusFilter}>
            <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent className="bg-[#05070d] border-[#1f2937] text-white">
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="requested">Solicitados</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="rejected">Rejeitados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">De (Data)</Label>
          <Input
            type="date"
            value={refundDateStartFilter}
            onChange={(e) => setRefundDateStartFilter(e.target.value)}
            className="bg-[#05070d] border-[#1f2937] text-white"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Até (Data)</Label>
          <Input
            type="date"
            value={refundDateEndFilter}
            onChange={(e) => setRefundDateEndFilter(e.target.value)}
            className="bg-[#05070d] border-[#1f2937] text-white"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Busca (ID)</Label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Agendamento/Pagamento"
              value={refundSearchTerm}
              onChange={(e) => setRefundSearchTerm(e.target.value)}
              className="bg-[#05070d] border-[#1f2937] text-white pl-9"
            />
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card text-foreground overflow-x-auto custom-scrollbar shadow-sm">
        <Table className="min-w-[800px] md:min-w-0">
          <TableHeader className="bg-background">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-muted-foreground">Solicitado em</TableHead>
              <TableHead className="text-muted-foreground">Cliente</TableHead>
              <TableHead className="text-muted-foreground">Chave Pix</TableHead>
              <TableHead className="text-muted-foreground">Valor</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingRefunds ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20">
                  <RefreshCcw className="animate-spin h-6 w-6 text-primary mx-auto" />
                </TableCell>
              </TableRow>
            ) : refundRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                  Nenhuma solicitação de estorno encontrada.
                </TableCell>
              </TableRow>
            ) : (
              refundRequests.map((req) => (
                <TableRow key={req.id} className="border-border hover:bg-muted/50 transition-colors">
                  <TableCell className="text-xs">{format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell className="font-bold">
                    <div className="flex flex-col">
                      <span>{req.customer?.name || "Cliente"}</span>
                      <span className="text-[10px] text-zinc-500 font-normal uppercase">
                        {req.appointment?.service_name || "Serviço"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {req.pix_key ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-emerald-400">{req.pix_key}</span>
                        <span className="text-[9px] text-zinc-500 uppercase">
                          {req.pix_type} - {req.holder_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="font-black text-red-500">R$ {Number(req.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-bold uppercase text-[10px]",
                        req.status === "requested"
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                          : req.status === "approved"
                            ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                            : req.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-red-500/10 text-red-500 border-red-500/20",
                      )}
                    >
                      {req.status === "requested"
                        ? "Pendente"
                        : req.status === "approved"
                          ? "Aprovado"
                          : req.status === "completed"
                            ? "Concluído"
                            : req.status === "rejected"
                              ? "Rejeitado"
                              : req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary hover:bg-primary/10">
                            <History size={14} /> Detalhes
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white max-w-md">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <History className="h-5 w-5 text-primary" /> Informações do Estorno
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 my-4">
                            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                                Dados do Pagamento
                              </p>
                              <p className="text-sm">
                                <strong>Método:</strong> {req.payment_method || "Pix"}
                              </p>
                              <p className="text-sm">
                                <strong>ID Pagamento:</strong>{" "}
                                <span className="text-xs text-zinc-400 break-all">{req.payment_id || "N/A"}</span>
                              </p>
                              {req.pix_key && (
                                <>
                                  <div className="h-px bg-zinc-800 my-2" />
                                  <p className="text-sm">
                                    <strong>Chave Pix:</strong> {req.pix_key}
                                  </p>
                                  <p className="text-sm">
                                    <strong>Tipo:</strong> {req.pix_type}
                                  </p>
                                  <p className="text-sm">
                                    <strong>Titular:</strong> {req.holder_name}
                                  </p>
                                </>
                              )}
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Histórico de Alterações
                              </p>
                              <AuditTrail refundId={req.id} />
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {req.status === "requested" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                            onClick={() => handleUpdateRefundStatus(req.id, "approved")}
                          >
                            Aprovar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                            onClick={() => {
                              const reason = prompt("Motivo da rejeição:");
                              if (reason) handleUpdateRefundStatus(req.id, "rejected", reason);
                            }}
                          >
                            Rejeitar
                          </Button>
                        </>
                      )}
                      {req.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold"
                          onClick={() => handleUpdateRefundStatus(req.id, "completed")}
                        >
                          Marcar como Pago
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
