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
  AlertCircle,
  Pencil,
  Copy,
  Save,
  X
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
import { Card, CardContent } from "@/components/ui/card";

interface Coupon {
  id: string;
  tenant_id: string;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  minimum_amount: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export function CouponManagement() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);
  
  const initialCouponState = {
    code: "",
    type: "fixed" as "fixed" | "percentage",
    value: 0,
    minimum_amount: 0,
    max_discount: undefined as number | undefined,
    usage_limit: undefined as number | undefined,
    expires_at: "",
    active: true
  };

  const [couponForm, setCouponForm] = useState(initialCouponState);

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
      return data as Coupon[];
    }
  });

  const saveCouponMutation = useMutation({
    mutationFn: async (data: typeof couponForm & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const payload = {
        tenant_id: user.id,
        code: data.code.toUpperCase().trim(),
        type: data.type,
        value: data.value,
        minimum_amount: data.minimum_amount || 0,
        max_discount: data.max_discount || null,
        usage_limit: data.usage_limit || null,
        expires_at: data.expires_at || null,
        active: data.active
      };

      if (data.id) {
        const { error } = await supabase
          .from("coupons")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("coupons")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setIsDialogOpen(false);
      setEditingCoupon(null);
      setCouponForm(initialCouponState);
      toast.success(editingCoupon ? "Cupom atualizado!" : "Cupom criado!");
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error("Este código de cupom já existe!");
      } else {
        toast.error("Erro ao salvar cupom: " + error.message);
      }
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
      toast.success("Status atualizado!");
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

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minimum_amount: coupon.minimum_amount || 0,
      max_discount: coupon.max_discount || undefined,
      usage_limit: coupon.usage_limit || undefined,
      expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : "",
      active: coupon.active
    });
    setIsDialogOpen(true);
  };

  const handleDuplicate = (coupon: Coupon) => {
    setEditingCoupon(null);
    setCouponForm({
      code: `${coupon.code}-COPIA`,
      type: coupon.type,
      value: coupon.value,
      minimum_amount: coupon.minimum_amount || 0,
      max_discount: coupon.max_discount || undefined,
      usage_limit: coupon.usage_limit || undefined,
      expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : "",
      active: false
    });
    setIsDialogOpen(true);
  };

  const handleOpenNew = () => {
    setEditingCoupon(null);
    setCouponForm(initialCouponState);
    setIsDialogOpen(true);
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400">Carregando cupons...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#ea580c]/10 rounded-2xl shadow-[0_0_15px_rgba(234,88,12,0.1)]">
            <TicketPercent className="text-[#ea580c] h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">Cupons Premium</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Gerencie promoções e fidelize com elegância.</p>
          </div>
        </div>
        <Button 
          onClick={handleOpenNew} 
          className="gap-2 bg-[#ea580c] hover:bg-[#ea580c]/90 text-black font-black uppercase italic tracking-widest h-9 px-4 rounded-lg shadow-md hover:scale-105 transition-all"
        >
          <Plus size={14} /> Novo Cupom
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#0b0f17] border-[#1f2937] text-white rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic tracking-widest flex items-center gap-2">
              {editingCoupon ? <Pencil size={18} className="text-[#ea580c]" /> : <Plus size={18} className="text-[#ea580c]" />}
              {editingCoupon ? "Editar Cupom" : "Novo Cupom Premium"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code" className="text-slate-400">Código do Cupom</Label>
              <Input 
                id="code" 
                placeholder="EX: VERÃO20" 
                value={couponForm.code}
                onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})}
                className="bg-[#2a2b2e] border-slate-700 text-white placeholder:text-slate-600 focus:ring-[#ea580c]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-slate-400">Tipo</Label>
                <Select 
                  value={couponForm.type} 
                  onValueChange={v => setCouponForm({...couponForm, type: v as any})}
                >
                  <SelectTrigger className="bg-[#2a2b2e] border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1b1e] border-slate-800 text-white">
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-400">Valor do Desconto</Label>
                <Input 
                  type="number" 
                  value={couponForm.value}
                  onChange={e => setCouponForm({...couponForm, value: Number(e.target.value)})}
                  className="bg-[#2a2b2e] border-slate-700 text-white focus:ring-[#ea580c]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-slate-400">Pedido Mínimo (R$)</Label>
                <Input 
                  type="number" 
                  value={couponForm.minimum_amount}
                  onChange={e => setCouponForm({...couponForm, minimum_amount: Number(e.target.value)})}
                  className="bg-[#2a2b2e] border-slate-700 text-white focus:ring-[#ea580c]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-400">Limite de Uso</Label>
                <Input 
                  type="number" 
                  placeholder="∞"
                  value={couponForm.usage_limit || ""}
                  onChange={e => setCouponForm({...couponForm, usage_limit: e.target.value ? Number(e.target.value) : undefined})}
                  className="bg-[#2a2b2e] border-slate-700 text-white focus:ring-[#ea580c]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-slate-400">Data de Expiração</Label>
                <Input 
                  type="date" 
                  value={couponForm.expires_at}
                  onChange={e => setCouponForm({...couponForm, expires_at: e.target.value})}
                  className="bg-[#2a2b2e] border-slate-700 text-white focus:ring-[#ea580c] [color-scheme:dark]"
                />
              </div>
              <div className="flex items-center justify-between pt-8">
                <Label className="text-slate-400">Ativo</Label>
                <Switch 
                  checked={couponForm.active}
                  onCheckedChange={v => setCouponForm({...couponForm, active: v})}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2 border-t border-[#1f2937]/50 pt-4 mt-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-white rounded-xl h-12"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => saveCouponMutation.mutate({ ...couponForm, id: editingCoupon?.id })}
              disabled={saveCouponMutation.isPending || !couponForm.code || couponForm.value <= 0}
              className="bg-[#ea580c] hover:bg-[#ea580c]/90 text-black font-black uppercase tracking-widest h-12 rounded-xl flex-1"
            >
              {saveCouponMutation.isPending ? "Salvando..." : (editingCoupon ? "Salvar Alterações" : "Criar Cupom Premium")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="bg-[#0b0f17] border border-[#1f2937] shadow-2xl overflow-hidden rounded-[20px]">
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader className="bg-[#05070d] border-b border-[#1f2937]">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="text-[#ea580c] font-black uppercase text-[10px] tracking-[0.2em] h-12">Código</TableHead>
                  <TableHead className="text-[#ea580c] font-black uppercase text-[10px] tracking-[0.2em] h-12">Desconto</TableHead>
                  <TableHead className="text-[#ea580c] font-black uppercase text-[10px] tracking-[0.2em] h-12">Uso / Limite</TableHead>
                  <TableHead className="text-[#ea580c] font-black uppercase text-[10px] tracking-[0.2em] h-12">Validade</TableHead>
                  <TableHead className="text-[#ea580c] font-black uppercase text-[10px] tracking-[0.2em] h-12">Status</TableHead>
                  <TableHead className="text-[#ea580c] font-black uppercase text-[10px] tracking-[0.2em] h-12 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons?.length === 0 ? (
                  <TableRow className="border-none hover:bg-transparent">
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500 italic">
                      Nenhum cupom encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  coupons?.map((coupon) => (
                    <TableRow key={coupon.id} className="border-b border-[#1f2937]/30 hover:bg-[#ea580c]/5 transition-colors group">
                      <TableCell className="font-bold">
                        <div className="flex items-center gap-3 text-white">
                          <div className="p-2 bg-[#05070d] border border-[#1f2937] rounded-lg group-hover:border-[#ea580c]/30 transition-all">
                            <Tag size={14} className="text-[#ea580c]" />
                          </div>
                          <span className="font-black italic tracking-tight">{coupon.code}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-emerald-500 font-black italic text-base">
                          {coupon.type === 'fixed' ? `R$ ${coupon.value}` : `${coupon.value}%`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase">
                          <Hash size={12} className="text-slate-700" />
                          <span className="text-white">{coupon.used_count || 0}</span>
                          <span className="text-slate-800">/</span>
                          <span>{coupon.usage_limit || "∞"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                          <Calendar size={12} />
                          {coupon.expires_at ? format(new Date(coupon.expires_at), "dd/MM/yyyy") : "Sem expiração"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={!!coupon.active} 
                            onCheckedChange={(v) => toggleCouponMutation.mutate({ id: coupon.id, active: v })}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                          <Badge className={coupon.active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-slate-800 text-slate-500 border-slate-700"}>
                            {coupon.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 pr-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-slate-400 hover:text-[#ea580c] hover:bg-[#ea580c]/10 rounded-xl transition-all"
                            onClick={() => handleEdit(coupon)}
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-slate-400 hover:text-white hover:bg-[#ea580c]/20 rounded-xl transition-all"
                            onClick={() => handleDuplicate(coupon)}
                            title="Duplicar"
                          >
                            <Copy size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-rose-500/50 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                            onClick={() => {
                              if (confirm("Deseja realmente excluir este cupom?")) {
                                deleteCouponMutation.mutate(coupon.id);
                              }
                            }}
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden divide-y divide-[#1f2937]/50 bg-[#0b0f17]">
            {coupons?.length === 0 ? (
              <div className="p-12 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest italic">
                Nenhum cupom encontrado.
              </div>
            ) : (
              coupons?.map((coupon) => (
                <div key={coupon.id} className="p-6 space-y-6 hover:bg-[#ea580c]/5 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-800 rounded-lg">
                        <Tag size={16} className="text-[#ea580c]" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Código</p>
                        <span className="text-base font-black text-white">{coupon.code}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Desconto</p>
                      <span className="text-lg font-black text-emerald-500 italic">
                        {coupon.type === 'fixed' ? `R$ ${coupon.value}` : `${coupon.value}%`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#05070d] p-4 rounded-2xl border border-[#1f2937]/50 shadow-inner">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Uso / Limite</p>
                      <div className="flex items-center gap-2 text-xs font-black text-white italic">
                        <Hash size={12} className="text-[#ea580c]" />
                        {coupon.used_count || 0} <span className="text-slate-700">/</span> {coupon.usage_limit || "∞"}
                      </div>
                    </div>
                    <div className="bg-[#05070d] p-4 rounded-2xl border border-[#1f2937]/50 shadow-inner">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Expiração</p>
                      <div className="flex items-center gap-2 text-xs font-black text-white italic">
                        <Calendar size={12} className="text-[#ea580c]" />
                        {coupon.expires_at ? format(new Date(coupon.expires_at), "dd/MM/yy") : "ILIMITADO"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={!!coupon.active} 
                        onCheckedChange={(v) => toggleCouponMutation.mutate({ id: coupon.id, active: v })}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                      <Badge className={coupon.active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-slate-800 text-slate-500 border-slate-700"}>
                        {coupon.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-11 w-11 p-0 rounded-xl bg-[#05070d] border border-[#1f2937] text-[#ea580c]"
                        onClick={() => handleEdit(coupon)}
                      >
                        <Pencil size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-11 w-11 p-0 rounded-xl bg-[#05070d] border border-[#1f2937] text-white"
                        onClick={() => handleDuplicate(coupon)}
                      >
                        <Copy size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-11 w-11 p-0 rounded-xl bg-[#05070d] border border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                        onClick={() => {
                          if (confirm("Deseja realmente excluir este cupom?")) {
                            deleteCouponMutation.mutate(coupon.id);
                          }
                        }}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
