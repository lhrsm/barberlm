import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

type Props = {
  appointments: any[];
  role: string | null | undefined;
  onOpenDetails: (id: string) => void;
};

export function PendingTab({ appointments, role, onOpenDetails }: Props) {
  const colSpan = role !== "barber" ? 7 : 6;
  return (
    <div className="border border-border rounded-xl bg-card text-foreground overflow-x-auto custom-scrollbar shadow-sm">
      <Table className="min-w-[800px] md:min-w-0">
        <TableHeader className="bg-background">
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="w-[100px] text-muted-foreground">Data</TableHead>
            <TableHead className="w-[100px] text-muted-foreground">Hora</TableHead>
            <TableHead className="text-muted-foreground">Cliente</TableHead>
            <TableHead className="text-muted-foreground">Serviço</TableHead>
            {role !== "barber" && <TableHead className="text-muted-foreground">Barbeiro</TableHead>}
            <TableHead className="text-right text-muted-foreground">Valor</TableHead>
            <TableHead className="text-right text-muted-foreground">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                Nenhum agendamento pendente de pagamento.
              </TableCell>
            </TableRow>
          ) : (
            appointments.map((app) => (
              <TableRow key={app.id} className="border-border hover:bg-muted/50 transition-colors">
                <TableCell className="whitespace-nowrap text-foreground">
                  {new Date(app.start_time).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium text-foreground">
                    {new Date(app.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </TableCell>
                <TableCell className="font-medium text-foreground">{app.customers?.name || "Cliente"}</TableCell>
                <TableCell className="text-muted-foreground">{app.services?.name || "Serviço"}</TableCell>
                {role !== "barber" && <TableCell>{app.barber?.name || "Geral"}</TableCell>}
                <TableCell className="text-right font-bold text-yellow-500">
                  R$ {(parseFloat(String(app.total_price)) || 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => onOpenDetails(app.id)}
                    >
                      <Check size={14} /> Confirmar / Detalhes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (app.management_token) {
                          window.open(`/agendamento/${app.management_token}`, "_blank");
                        } else {
                          onOpenDetails(app.id);
                        }
                      }}
                    >
                      <X size={14} /> Cancelar (Via Link Público)
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
