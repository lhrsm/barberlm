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
    type: "fixed" as const,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#ea580c]/10 rounded-lg">
            <TicketPercent className="text-[#ea580c] h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Cupons de Desconto</h2>
            <p className="text-sm text-slate-400">Gerencie suas promoções e fidelize clientes.</p>
          </div>
        </div>
        <Button onClick={handleOpenNew} className="gap-2 bg-[#ea580c] hover:bg-[#ea580c]/90 text-white border-none">
          <Plus size={18} /> Novo Cupom
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1a1b1e] border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {editingCoupon ? <Pencil size={18} /> : <Plus size={18} />}
              {editingCoupon ? "Editar Cupom" : "Novo Cupom"}
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
                  value={couponForm.type as string} 
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => saveCouponMutation.mutate({ ...couponForm, id: editingCoupon?.id })}
              disabled={saveCouponMutation.isPending || !couponForm.code || couponForm.value <= 0}
              className="bg-[#ea580c] hover:bg-[#ea580c]/90 text-white"
            >
              {saveCouponMutation.isPending ? "Salvando..." : (editingCoupon ? "Salvar Alterações" : "Criar Cupom")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="bg-[#1a1b1e] border-slate-800 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader className="bg-[#2a2b2e]/50 border-slate-800">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Código</TableHead>
                  <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Desconto</TableHead>
                  <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Uso / Limite</TableHead>
                  <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Validade</TableHead>
                  <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Status</TableHead>
                  <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-wider text-right">Ações</TableHead>
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
                    <TableRow key={coupon.id} className="border-slate-800 hover:bg-[#2a2b2e]/30 transition-colors">
                      <TableCell className="font-bold">
                        <div className="flex items-center gap-2 text-white">
                          <div className="p-1.5 bg-slate-800 rounded">
                            <Tag size={12} className="text-[#ea580c]" />
                          </div>
                          {coupon.code}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-emerald-500 font-bold italic">
                          {coupon.type === 'fixed' ? `R$ ${coupon.value}` : `${coupon.value}%`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-slate-300 text-sm">
                          <Hash size={12} className="text-slate-500" />
                          <span className="font-mono">{coupon.used_count || 0}</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-slate-400">{coupon.usage_limit || "∞"}</span>
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
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                            onClick={() => handleEdit(coupon)}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                            onClick={() => handleDuplicate(coupon)}
                            title="Duplicar"
                          >
                            <Copy size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => {
                              if (confirm("Deseja realmente excluir este cupom?")) {
                                deleteCouponMutation.mutate(coupon.id);
                              }
                            }}
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden divide-y divide-slate-800">
            {coupons?.length === 0 ? (
              <div className="p-12 text-center text-slate-500 italic">
                Nenhum cupom encontrado.
              </div>
            ) : (
              coupons?.map((coupon) => (
                <div key={coupon.id} className="p-4 space-y-4 hover:bg-[#2a2b2e]/20 transition-colors">
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#2a2b2e]/50 p-3 rounded-xl border border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Uso / Limite</p>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                        <Hash size={12} className="text-[#ea580c]" />
                        {coupon.used_count || 0} / {coupon.usage_limit || "∞"}
                      </div>
                    </div>
                    <div className="bg-[#2a2b2e]/50 p-3 rounded-xl border border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Validade</p>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                        <Calendar size={12} className="text-[#ea580c]" />
                        {coupon.expires_at ? format(new Date(coupon.expires_at), "dd/MM/yyyy") : "Sem expiração"}
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
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 w-9 p-0 rounded-lg text-slate-400 hover:bg-slate-800"
                        onClick={() => handleEdit(coupon)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 w-9 p-0 rounded-lg text-slate-400 hover:bg-slate-800"
                        onClick={() => handleDuplicate(coupon)}
                      >
                        <Copy size={14} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 w-9 p-0 rounded-lg text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          if (confirm("Deseja realmente excluir este cupom?")) {
                            deleteCouponMutation.mutate(coupon.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
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
