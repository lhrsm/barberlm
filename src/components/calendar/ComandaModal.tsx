import * as React from "react";
import { useEffect, useState } from "react";
import { Plus, Minus, Trash2, Package, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ComandaModalProps {
  appointmentId: string;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  image_url?: string | null;
}

interface ComandaSale {
  id: string;
  total_amount: number;
  created_at: string;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
}

export function ComandaModal({ appointmentId, tenantId, open, onOpenChange, onChanged }: ComandaModalProps) {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<ComandaSale[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [prodRes, saleRes] = await Promise.all([
        supabase.from("products").select("id, name, price, stock_quantity, image_url")
          .eq("user_id", tenantId).order("name"),
        supabase.from("product_sales").select("id, total_amount, created_at, items")
          .eq("appointment_id", appointmentId).order("created_at", { ascending: true }),
      ]);
      if (prodRes.data) setProducts(prodRes.data as any);
      if (saleRes.data) setSales(saleRes.data as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSearch("");
      setQuantities({});
      load();
    }
  }, [open, appointmentId]);

  const bumpQty = (id: string, delta: number) => {
    setQuantities(q => ({ ...q, [id]: Math.max(1, (q[id] || 1) + delta) }));
  };

  const addProduct = async (product: Product) => {
    const qty = quantities[product.id] || 1;
    if (product.stock_quantity < qty) {
      toast.error(`Estoque insuficiente (disponível: ${product.stock_quantity})`);
      return;
    }
    setBusyId(product.id);
    try {
      const { data, error } = await supabase.rpc("add_product_to_comanda", {
        p_appointment_id: appointmentId,
        p_product_id: product.id,
        p_quantity: qty,
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error("Falha ao adicionar");
      toast.success(`${product.name} adicionado à comanda`);
      await load();
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onChanged?.();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("insufficient_stock")) toast.error("Estoque insuficiente");
      else if (msg.includes("forbidden")) toast.error("Você não tem permissão para esta comanda");
      else toast.error("Erro ao adicionar produto: " + msg);
    } finally {
      setBusyId(null);
    }
  };

  const removeSale = async (saleId: string) => {
    setBusyId(saleId);
    try {
      const { data, error } = await supabase.rpc("remove_comanda_item", { p_sale_id: saleId });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error("Falha ao remover");
      toast.success("Item removido da comanda");
      await load();
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onChanged?.();
    } catch (err: any) {
      toast.error("Erro ao remover: " + (err?.message || ""));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const comandaTotal = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0f17] border-[#D4AF37]/20 text-white rounded-[2rem] sm:max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4 border-b border-[#D4AF37]/10">
          <DialogTitle className="text-xl font-black uppercase italic text-[#D4AF37] flex items-center gap-3">
            <ShoppingBag className="h-5 w-5" /> Comanda Digital
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-xs">
            Adicione produtos consumidos durante o atendimento. O valor entra automaticamente na conta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-0 max-h-[70vh]">
          {/* Products list */}
          <div className="p-6 border-r border-white/5 overflow-y-auto">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">Produtos disponíveis</p>
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3 bg-black/30 border-white/10 text-white placeholder:text-gray-600"
            />
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#D4AF37]" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                <Package className="mx-auto mb-2 opacity-50" />
                Nenhum produto encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(p => {
                  const qty = quantities[p.id] || 1;
                  const noStock = p.stock_quantity <= 0;
                  return (
                    <div key={p.id} className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-[#D4AF37]/30 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{p.name}</p>
                          <p className="text-xs text-[#D4AF37] font-black">R$ {Number(p.price).toFixed(2)}</p>
                        </div>
                        <Badge variant="outline" className={`text-[9px] ${noStock ? "text-red-400 border-red-500/30" : "text-emerald-400 border-emerald-500/30"}`}>
                          {p.stock_quantity} em estoque
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-black/40 rounded-lg border border-white/10">
                          <button
                            className="px-2 py-1 text-gray-400 hover:text-white disabled:opacity-30"
                            onClick={() => bumpQty(p.id, -1)}
                            disabled={qty <= 1}
                          ><Minus className="h-3 w-3" /></button>
                          <span className="px-2 text-xs font-bold w-6 text-center">{qty}</span>
                          <button
                            className="px-2 py-1 text-gray-400 hover:text-white disabled:opacity-30"
                            onClick={() => bumpQty(p.id, 1)}
                            disabled={qty >= p.stock_quantity}
                          ><Plus className="h-3 w-3" /></button>
                        </div>
                        <Button
                          size="sm"
                          className="flex-1 h-9 bg-[#D4AF37] hover:bg-[#B8962E] text-black font-black uppercase text-[10px] tracking-widest rounded-lg"
                          onClick={() => addProduct(p)}
                          disabled={busyId === p.id || noStock}
                        >
                          {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Adicionar"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comanda / running tab */}
          <div className="p-6 overflow-y-auto bg-black/20">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">Comanda atual</p>
            {sales.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                Nenhum produto na comanda.
              </div>
            ) : (
              <div className="space-y-2">
                {sales.map(s => (
                  <div key={s.id} className="p-3 rounded-xl bg-zinc-900/50 border border-white/5">
                    {(s.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-gray-300">{it.quantity}x {it.name}</span>
                        <span className="text-white font-bold">R$ {Number(it.price * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                      <span className="text-[10px] text-gray-500 uppercase font-bold">Subtotal</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#D4AF37] font-black text-sm">R$ {Number(s.total_amount).toFixed(2)}</span>
                        <button
                          className="text-red-400/70 hover:text-red-400 disabled:opacity-30"
                          onClick={() => removeSale(s.id)}
                          disabled={busyId === s.id}
                          title="Remover"
                        >
                          {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/30">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">Total da Comanda</span>
                <span className="text-2xl font-black text-white">R$ {comandaTotal.toFixed(2)}</span>
              </div>
              <p className="text-[9px] text-gray-500 mt-2">Valor já somado ao total do atendimento.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t border-[#D4AF37]/10 bg-[#05070d]/50">
          <Button
            onClick={() => onOpenChange(false)}
            className="rounded-xl bg-[#D4AF37] hover:bg-[#B8962E] text-black font-black uppercase text-[10px] tracking-widest px-8 h-11"
          >
            Fechar Comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
