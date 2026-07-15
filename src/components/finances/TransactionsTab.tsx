import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionsDesktopTable } from "./TransactionsDesktopTable";
import { TransactionsMobileList } from "./TransactionsMobileList";
import { EditTransactionDialog } from "./EditTransactionDialog";

type Props = {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  filteredTransactions: any[];
  role: string | null | undefined;
  editingTransaction: any;
  setEditingTransaction: (t: any) => void;
  isEditDialogOpen: boolean;
  setIsEditDialogOpen: (v: boolean) => void;
  handleUpdateTransaction: (e: React.FormEvent) => void | Promise<void>;
  handleDeleteTransaction: (id: string) => void | Promise<void>;
  setSelectedAppointmentId: (id: string | null) => void;
  setIsDetailsModalOpen: (v: boolean) => void;
  customers: any[];
  barbers: any[];
};

export function TransactionsTab({
  statusFilter,
  setStatusFilter,
  dateFilter,
  setDateFilter,
  filteredTransactions,
  role,
  editingTransaction,
  setEditingTransaction,
  isEditDialogOpen,
  setIsEditDialogOpen,
  handleUpdateTransaction,
  handleDeleteTransaction,
  setSelectedAppointmentId,
  setIsDetailsModalOpen,
  customers,
  barbers,
}: Props) {
  const openEdit = (t: any) => {
    setEditingTransaction(t);
    setIsEditDialogOpen(true);
  };
  const openDetails = (id: string | null) => {
    setSelectedAppointmentId(id);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end bg-card p-4 border border-border rounded-xl text-foreground">
        <div className="space-y-2">
          <Label htmlFor="filter-status">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="filter-status" className="w-[180px] bg-background border-border">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
              <SelectItem value="manual">Lançamentos Manuais</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="filter-date">Data</Label>
          <Input
            id="filter-date"
            type="date"
            className="w-[180px] bg-background border-border"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setStatusFilter("all");
            setDateFilter(new Date().toISOString().split("T")[0]);
          }}
          className="h-10 hover:bg-accent hover:text-accent-foreground"
        >
          Limpar Filtros
        </Button>
      </div>

      <div className="border border-border rounded-xl bg-card text-foreground overflow-hidden shadow-sm">
        <TransactionsDesktopTable
          transactions={filteredTransactions}
          role={role ?? undefined}
          onEdit={openEdit}
          onOpenDetails={openDetails}
          onDelete={handleDeleteTransaction}
        />

        <EditTransactionDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsEditDialogOpen(false);
              setEditingTransaction(null);
            }
          }}
          editingTransaction={editingTransaction}
          setEditingTransaction={setEditingTransaction}
          onSubmit={handleUpdateTransaction}
          customers={customers}
          barbers={barbers}
        />

        <TransactionsMobileList
          transactions={filteredTransactions}
          onOpenDetails={openDetails}
          onEdit={openEdit}
          onDelete={handleDeleteTransaction}
        />
      </div>
    </div>
  );
}
