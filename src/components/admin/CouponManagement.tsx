import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  TicketPercent, 
  Plus, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  Tag,
  Hash,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CouponManagement() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    type: "fixed",
    value: 0,
    minimum_amount: 0,
    max_discount: undefined as number | undefined,
    usage_limit: undefined as number | undefined,
    expires_at: "",
    active: true
  });

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const createCouponMutation = useMutation({
    mutationFn: async (coupon: typeof newCoupon) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("coupons")
        .insert([{
          tenant_id: user.id,
          code: coupon.code.toUpperCase().trim(),
          type: coupon.type,
          value: coupon.value,
          minimum_amount: coupon.minimum_amount,
          max_discount: coupon.max_discount,
          usage_limit: coupon.usage_limit,
          expires_at: coupon.expires_at || null,
          active: coupon.active
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setIsAddDialogOpen(false);
      setNewCoupon({
        code: "",
        type: "fixed",
        value: 0,
        minimum_amount: 0,
        max_discount: undefined,
        usage_limit: undefined,
        expires_at: "",
        active: true
      });
      toast.success("Cupom criado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar cupom: " + error.message);
    }
  });

  const toggleCouponMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string, active: boolean }) => {
      const { error } = await supabase
        .from("coupons")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Status do cupom atualizado!");
    }
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Cupom excluído!");
    }
  });

  if (isLoading) return <div className="p-8 text-center">Carregando cupons...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TicketPercent className="text-primary h-6 w-6" />
          <div>
            <h2 className="text-xl font-bold">Cupons de Desconto</h2>
            <p className="text-sm text-muted-foreground">Gerencie suas promoções e descontos.</p>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={18} /> Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Cupom</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Código do Cupom</Label>
                <Input 
                  id="code" 
                  placeholder="EX: VERÃO20" 
                  value={newCoupon.code}
                  onChange={e => setNewCoupon({...newCoupon, code: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={newCoupon.type} 
                    onValueChange={v => setNewCoupon({...newCoupon, type: v as any})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Valor do Desconto</Label>
                  <Input 
                    type="number" 
                    value={newCoupon.value}
                    onChange={e => setNewCoupon({...newCoupon, value: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Pedido Mínimo (R$)</Label>
                  <Input 
                    type="number" 
                    value={newCoupon.minimum_amount}
                    onChange={e => setNewCoupon({...newCoupon, minimum_amount: Number(e.target.value)})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Limite de Uso (Total)</Label>
                  <Input 
                    type="number" 
                    placeholder="Opcional"
                    value={newCoupon.usage_limit || ""}
                    onChange={e => setNewCoupon({...newCoupon, usage_limit: e.target.value ? Number(e.target.value) : undefined})}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Data de Expiração</Label>
                <Input 
                  type="date" 
                  value={newCoupon.expires_at}
                  onChange={e => setNewCoupon({...newCoupon, expires_at: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => createCouponMutation.mutate(newCoupon)}
                disabled={!newCoupon.code || newCoupon.value <= 0}
              >
                Criar Cupom
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-2 border-slate-200 rounded-xl bg-white text-black overflow-hidden shadow-sm">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Uso / Limite</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {coupons?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                  Nenhum cupom cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              coupons?.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-bold">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-primary" />
                      {coupon.code}
                    </div>
                  </TableCell>
                  <TableCell>
                    {coupon.type === 'fixed' ? `R$ ${coupon.value}` : `${coupon.value}%`}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-xs">
                        <Hash size={12} /> {coupon.used_count || 0} / {coupon.usage_limit || "∞"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {coupon.expires_at ? (
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar size={12} />
                        {format(new Date(coupon.expires_at), "dd/MM/yyyy")}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem expiração</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={!!coupon.active} 
                        onCheckedChange={(v) => toggleCouponMutation.mutate({ id: coupon.id, active: v })}
                      />
                      <Badge variant={coupon.active ? "default" : "secondary"}>
                        {coupon.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => {
                        if (confirm("Deseja realmente excluir este cupom?")) {
                          deleteCouponMutation.mutate(coupon.id);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {coupons?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground italic">
              Nenhum cupom cadastrado.
            </div>
          ) : (
            coupons?.map((coupon) => (
              <div key={coupon.id} className="p-4 space-y-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Tag size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Código</p>
                      <span className="text-base font-black text-slate-900">{coupon.code}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Desconto</p>
                    <span className="text-lg font-black text-emerald-600 italic">
                      {coupon.type === 'fixed' ? `R$ ${coupon.value}` : `${coupon.value}%`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Uso / Limite</p>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Hash size={12} className="text-slate-400" />
                      {coupon.used_count || 0} / {coupon.usage_limit || "∞"}
                    </div>
                  </div>
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Validade</p>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Calendar size={12} className="text-slate-400" />
                      {coupon.expires_at ? format(new Date(coupon.expires_at), "dd/MM/yyyy") : "Sem expiração"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={!!coupon.active} 
                      onCheckedChange={(v) => toggleCouponMutation.mutate({ id: coupon.id, active: v })}
                    />
                    <Badge variant={coupon.active ? "default" : "secondary"} className="text-[10px] font-black uppercase italic">
                      {coupon.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 w-9 p-0 rounded-xl text-red-500 hover:bg-red-50"
                    onClick={() => {
                      if (confirm("Deseja realmente excluir este cupom?")) {
                        deleteCouponMutation.mutate(coupon.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
