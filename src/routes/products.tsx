import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  ShoppingBag, 
  Plus, 
  Package, 
  AlertTriangle, 
  Crown, 
  Image as ImageIcon, 
  Trash2, 
  Edit, 
  Copy,
  History,
  XCircle,
  RefreshCcw,
  CheckCircle2,
  Tag,
  Star,
  Layers,
  LayoutGrid
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/products")({
  component: ProductsComponent,
});

function ProductsComponent() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const { plan, limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [products, setProducts] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [newProduct, setNewProduct] = useState({ 
    name: "", 
    price: "", 
    promotional_price: "",
    stock_quantity: "0", 
    description: "",
    short_description: "",
    category: "Pomadas",
    brand: "",
    image_url: "",
    featured: false,
    badge: ""
  });
  
  const canAddProduct = usage.products < limits.products;

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
      return;
    }

    if (!loading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, loading, role, navigate]);

  useEffect(() => {
    if (user && role !== 'super_admin') fetchProducts();
  }, [user, role]);

  async function fetchProducts() {
    if (!user) return;
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("name");
    if (error) toast.error("Erro ao buscar produtos");
    else setProducts(data || []);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('barber-avatars') // Reusing the same bucket for simplicity or can create a new one
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('barber-avatars')
        .getPublicUrl(filePath);

      if (editingProduct) {
        setEditingProduct({ ...editingProduct, image_url: publicUrl });
      } else {
        setNewProduct({ ...newProduct, image_url: publicUrl });
      }
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao enviar imagem: " + error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update({
          ...editingProduct,
          price: parseFloat(editingProduct.price),
          promotional_price: editingProduct.promotional_price ? parseFloat(editingProduct.promotional_price) : null,
          stock_quantity: parseInt(editingProduct.stock_quantity),
        })
        .eq("id", editingProduct.id);

      if (error) {
        toast.error("Erro ao atualizar produto");
      } else {
        toast.success("Produto atualizado com sucesso!");
        setIsAddDialogOpen(false);
        setEditingProduct(null);
        fetchProducts();
      }
    } else {
      const { error } = await supabase.from("products").insert({
        ...newProduct,
        price: parseFloat(newProduct.price),
        promotional_price: newProduct.promotional_price ? parseFloat(newProduct.promotional_price) : null,
        stock_quantity: parseInt(newProduct.stock_quantity),
        user_id: user.id,
      } as any);

      if (error) {
        toast.error("Erro ao adicionar produto");
      } else {
        toast.success("Produto adicionado com sucesso!");
        setIsAddDialogOpen(false);
        setNewProduct({ 
          name: "", 
          price: "", 
          promotional_price: "",
          stock_quantity: "0", 
          description: "", 
          short_description: "",
          category: "Pomadas",
          brand: "",
          image_url: "",
          featured: false,
          badge: ""
        });
        fetchProducts();
        refreshLimits();
      }
    }
  }

  async function handleDeleteProduct(id: string) {
    const { error } = await supabase
      .from("products")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao remover produto");
    } else {
      toast.success("Produto removido");
      fetchProducts();
      refreshLimits();
    }
  }

  async function handleDuplicateProduct(product: any) {
    if (!user) return;
    
    if (usage.products >= limits.products) {
      toast.error(`Limite atingido! Seu plano permite apenas ${limits.products} produtos.`);
      return;
    }

    const { error } = await supabase.from("products").insert({
      name: `${product.name} (Cópia)`,
      price: product.price,
      stock_quantity: product.stock_quantity,
      description: product.description,
      image_url: product.image_url,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erro ao duplicar produto");
    } else {
      toast.success("Produto duplicado com sucesso!");
      fetchProducts();
      refreshLimits();
    }
  }

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
            <TabsTrigger value="inventory" className="gap-2">
              <Package size={16} /> Estoque
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <History size={16} /> Faturamento
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History size={16} /> Histórico Completo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-6 pt-6">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Produtos</h2>
            <p className="text-muted-foreground">Gerencie seu estoque de pomadas, balms e outros itens.</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) setEditingProduct(null);
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant={canAddProduct ? "default" : "secondary"} onClick={() => setEditingProduct(null)}>
                <Plus size={18} /> Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              {canAddProduct || editingProduct ? (
                <>
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? "Editar Produto" : "Adicionar Novo Produto"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddProduct} className="space-y-6 pt-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex flex-col items-center justify-center">
                          <div className="relative w-full aspect-square border-2 border-dashed rounded-2xl flex items-center justify-center overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors">
                            {(editingProduct?.image_url || newProduct.image_url) ? (
                              <img src={editingProduct?.image_url || newProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center p-4">
                                <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-20" />
                                <p className="text-xs text-muted-foreground">Arraste ou clique para enviar</p>
                              </div>
                            )}
                            <Input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleFileUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              disabled={uploading}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-2 uppercase font-black tracking-widest">{uploading ? "Enviando imagem..." : "Imagem Principal"}</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="category" className="text-xs font-black uppercase tracking-widest text-slate-500">Categoria</Label>
                          <Select 
                            value={editingProduct ? editingProduct.category : newProduct.category} 
                            onValueChange={(val) => editingProduct ? setEditingProduct({...editingProduct, category: val}) : setNewProduct({...newProduct, category: val})}
                          >
                            <SelectTrigger className="rounded-xl h-11">
                              <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pomadas">Pomadas</SelectItem>
                              <SelectItem value="Óleos para barba">Óleos para barba</SelectItem>
                              <SelectItem value="Shampoo">Shampoo</SelectItem>
                              <SelectItem value="Condicionador">Condicionador</SelectItem>
                              <SelectItem value="Balm">Balm</SelectItem>
                              <SelectItem value="Perfumes">Perfumes</SelectItem>
                              <SelectItem value="Kits">Kits</SelectItem>
                              <SelectItem value="Acessórios">Acessórios</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="brand" className="text-xs font-black uppercase tracking-widest text-slate-500">Marca</Label>
                          <Input 
                            id="brand" 
                            placeholder="Ex: Reuzel, Suavecito"
                            value={editingProduct ? editingProduct.brand : newProduct.brand} 
                            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, brand: e.target.value}) : setNewProduct({...newProduct, brand: e.target.value})} 
                            className="rounded-xl h-11"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-slate-500">Nome do Produto</Label>
                          <Input 
                            id="name" 
                            placeholder="Pomada Modeladora Efeito Matte"
                            value={editingProduct ? editingProduct.name : newProduct.name} 
                            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, name: e.target.value}) : setNewProduct({...newProduct, name: e.target.value})} 
                            required 
                            className="rounded-xl h-11"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="price" className="text-xs font-black uppercase tracking-widest text-slate-500">Preço (R$)</Label>
                            <Input 
                              id="price" 
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={editingProduct ? editingProduct.price : newProduct.price} 
                              onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, price: e.target.value}) : setNewProduct({...newProduct, price: e.target.value})} 
                              required
                              className="rounded-xl h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="promo" className="text-xs font-black uppercase tracking-widest text-slate-500">Promo (R$)</Label>
                            <Input 
                              id="promo" 
                              type="number"
                              step="0.01"
                              placeholder="Opcional"
                              value={editingProduct ? editingProduct.promotional_price : newProduct.promotional_price} 
                              onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, promotional_price: e.target.value}) : setNewProduct({...newProduct, promotional_price: e.target.value})} 
                              className="rounded-xl h-11"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="stock" className="text-xs font-black uppercase tracking-widest text-slate-500">Estoque</Label>
                            <Input 
                              id="stock" 
                              type="number"
                              value={editingProduct ? editingProduct.stock_quantity : newProduct.stock_quantity} 
                              onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, stock_quantity: e.target.value}) : setNewProduct({...newProduct, stock_quantity: e.target.value})} 
                              required
                              className="rounded-xl h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="badge" className="text-xs font-black uppercase tracking-widest text-slate-500">Selo (Badge)</Label>
                            <Select 
                              value={editingProduct ? editingProduct.badge : newProduct.badge} 
                              onValueChange={(val) => editingProduct ? setEditingProduct({...editingProduct, badge: val}) : setNewProduct({...newProduct, badge: val})}
                            >
                              <SelectTrigger className="rounded-xl h-11">
                                <SelectValue placeholder="Sem selo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Nenhum</SelectItem>
                                <SelectItem value="Mais vendido">Mais vendido</SelectItem>
                                <SelectItem value="Novo">Novo</SelectItem>
                                <SelectItem value="Premium">Premium</SelectItem>
                                <SelectItem value="Oferta">Oferta</SelectItem>
                                <SelectItem value="Exclusivo">Exclusivo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-bold">Produto em Destaque</Label>
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Aparece no topo da vitrine</p>
                          </div>
                          <Switch 
                            checked={editingProduct ? editingProduct.featured : newProduct.featured}
                            onCheckedChange={(val) => editingProduct ? setEditingProduct({...editingProduct, featured: val}) : setNewProduct({...newProduct, featured: val})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="short_desc" className="text-xs font-black uppercase tracking-widest text-slate-500">Breve Descrição (Vitrine)</Label>
                        <Input 
                          id="short_desc" 
                          placeholder="Ex: Fixação forte com brilho natural."
                          value={editingProduct ? editingProduct.short_description : newProduct.short_description} 
                          onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, short_description: e.target.value}) : setNewProduct({...newProduct, short_description: e.target.value})} 
                          className="rounded-xl h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-slate-500">Descrição Detalhada</Label>
                        <Textarea 
                          id="description" 
                          placeholder="Fale sobre os benefícios, modo de uso e diferenciais do produto..."
                          value={editingProduct ? editingProduct.description : newProduct.description} 
                          onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, description: e.target.value}) : setNewProduct({...newProduct, description: e.target.value})} 
                          className="rounded-2xl min-h-[120px] resize-none"
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-black uppercase tracking-tighter shadow-xl hover:scale-[1.01] transition-all" disabled={uploading}>
                      {editingProduct ? "Salvar Alterações" : "Cadastrar Produto Premium"}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="space-y-4 py-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Limite Atingido</AlertTitle>
                    <AlertDescription>
                      Seu plano atual permite apenas {limits.products} produtos. Faça o upgrade para adicionar mais.
                    </AlertDescription>
                  </Alert>
                  <Button className="w-full h-12 rounded-xl" asChild>
                    <Link to="/subscription">Ver Planos</Link>
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {!canAddProduct && (
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertTitle>Limite de Produtos</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              Você atingiu o limite de {limits.products} produtos do seu plano.
              <Button variant="link" size="sm" asChild className="p-0 h-auto">
                <Link to="/subscription">Fazer Upgrade</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.length === 0 ? (
            <div className="col-span-full text-center py-20 border-2 border-dashed rounded-3xl bg-muted/20 text-muted-foreground">
              <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl border">
                <ShoppingBag size={40} className="text-muted-foreground/30" />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Sua vitrine está vazia</h3>
              <p className="max-w-[300px] mx-auto text-sm mt-2 font-medium">Cadastre seus produtos premium para que seus clientes possam vê-los no seu site.</p>
              <Button className="mt-8 rounded-full h-11 px-8 gap-2" onClick={() => setIsAddDialogOpen(true)}>
                <Plus size={18} /> Adicionar Primeiro Produto
              </Button>
            </div>
          ) : (
            products.map((product) => (
              <motion.div 
                key={product.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative border-2 border-slate-200 rounded-[2.5rem] bg-white overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 text-black"
              >
                <div className="aspect-square bg-muted/20 relative overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
                      <Package className="w-20 h-20 text-muted-foreground/10" />
                    </div>
                  )}
                  
                  {product.badge && (
                    <div className="absolute top-4 left-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg z-10">
                      {product.badge}
                    </div>
                  )}

                  {product.featured && (
                    <div className="absolute top-4 right-4 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg z-10 flex items-center gap-1">
                      <Star size={10} fill="currentColor" /> Destaque
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center gap-3">
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="h-12 w-12 rounded-full bg-white text-black hover:bg-white/90 shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-500"
                      onClick={() => {
                        setEditingProduct(product);
                        setIsAddDialogOpen(true);
                      }}
                    >
                      <Edit size={20} />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="h-12 w-12 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-500"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      <Trash2 size={20} />
                    </Button>
                  </div>

                  {product.stock_quantity <= 5 && (
                    <div className="absolute bottom-4 left-4 right-4 bg-red-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest py-1.5 rounded-full text-center shadow-lg border border-white/20">
                      Estoque Crítico: {product.stock_quantity}
                    </div>
                  )}
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">{product.category}</p>
                    <h3 className="font-black text-xl uppercase italic tracking-tighter truncate" title={product.name}>{product.name}</h3>
                    {product.brand && <p className="text-xs font-bold text-slate-500">{product.brand}</p>}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-2">
                         <span className="text-2xl font-black text-white">R$ {Number(product.price).toFixed(2)}</span>
                         {product.promotional_price && (
                           <span className="text-xs text-slate-500 line-through font-bold">R$ {Number(product.promotional_price).toFixed(2)}</span>
                         )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                        <Package size={10} />
                        <span>{product.stock_quantity} un.</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="gap-2 rounded-full h-9 px-4"
                        onClick={async () => {
                          if (!user) return;
                          if (product.stock_quantity <= 0) {
                            toast.error("Produto sem estoque!");
                            return;
                          }
                          
                            // Encontrar um barbeiro para associar a venda (o tenant_admin ou o primeiro disponível)
                            const { data: barberData } = await supabase.from('barbers').select('id').eq('user_id', user.id).eq('active', true).limit(1).maybeSingle();
                            const barberId = role === 'barber' ? user.id : barberData?.id;

                            if (!barberId) {
                              toast.error("Não foi possível identificar um profissional para esta venda.");
                              return;
                            }

                            const { error: saleError } = await supabase.from("product_sales").insert([{
                              user_id: user.id,
                              barber_id: barberId,
                              items: [{ id: product.id, name: product.name, quantity: 1, price: product.price }],
                              total_amount: product.price,
                              status: 'completed' as "completed"
                            }]);

                            if (saleError) throw saleError;

                            const { error: stockError } = await supabase
                              .from("products")
                              .update({ stock_quantity: product.stock_quantity - 1 })
                              .eq("id", product.id);

                            if (stockError) throw stockError;
                            
                            // Adicionar ao financeiro
                            await supabase.from("transactions").insert([{
                              user_id: user.id,
                              barber_id: barberId,
                              amount: product.price,
                              type: "income",
                              category: "Venda de Produto",
                              description: `Venda: ${product.name}`,
                              date: new Date().toISOString().split('T')[0]
                            }]);

                            toast.success(`Venda de ${product.name} realizada!`);
                            fetchProducts();
                          } catch (error) {
                            toast.error("Erro ao realizar venda");
                          }
                        }}
                      >
                        <ShoppingBag size={16} /> Vender
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
          </TabsContent>

          <TabsContent value="billing" className="pt-6">
            <SalesHistory user={user} onStatusChange={fetchProducts} onlyCompleted={true} />
          </TabsContent>

          <TabsContent value="history" className="pt-6">
            <SalesHistory user={user} onStatusChange={fetchProducts} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function SalesHistory({ user, onStatusChange, onlyCompleted }: { user: any, onStatusChange?: () => void, onlyCompleted?: boolean }) {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    try {
      let query = supabase
        .from("product_sales")
        .select("*")
        .eq("user_id", user.id);

      if (onlyCompleted) {
        query = query.eq("status", "completed");
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error("Error fetching sales:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(saleId: string, newStatus: 'completed' | 'cancelled' | 'refunded') {
    try {
      const { error } = await supabase
        .from("product_sales")
        .update({ status: newStatus })
        .eq("id", saleId);

      if (error) throw error;
      toast.success(`Status atualizado para ${newStatus}`);
      fetchSales();
      if (onStatusChange) onStatusChange();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  }

  if (loading) return <div className="text-center py-12">Carregando histórico...</div>;

  return (
    <Card className="bg-white border-2 border-slate-200 text-black shadow-sm">
      <CardHeader>
        <CardTitle>{onlyCompleted ? "Faturamento de Produtos" : "Histórico de Vendas"}</CardTitle>
        <CardDescription>
          {onlyCompleted 
            ? "Acompanhe suas vendas concluídas (exclui cancelamentos e reembolsos)." 
            : "Acompanhe todas as suas vendas, incluindo cancelamentos e reembolsos."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History size={48} className="mx-auto mb-4 opacity-20" />
            <p>Nenhuma venda registrada ainda.</p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Itens</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((sale) => (
                  <tr key={sale.id} className="bg-white border-b border-slate-100 last:border-0 text-black">
                    <td className="px-4 py-4 whitespace-nowrap">
                      {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-4">
                      <div className="max-w-[200px] truncate">
                        {sale.items.map((item: any) => `${item.name} (x${item.quantity})`).join(", ")}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-bold">
                      R$ {sale.total_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        sale.status === 'completed' && "bg-green-100 text-green-700",
                        sale.status === 'cancelled' && "bg-red-100 text-red-700",
                        sale.status === 'refunded' && "bg-amber-100 text-amber-700"
                      )}>
                        {sale.status === 'completed' ? 'Concluída' : 
                         sale.status === 'cancelled' ? 'Cancelada' : 'Reembolsada'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {sale.status === 'completed' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 px-2 text-[10px] gap-1"
                              onClick={() => updateStatus(sale.id, 'cancelled')}
                            >
                              <XCircle size={12} /> Cancelar
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 px-2 text-[10px] gap-1"
                              onClick={() => updateStatus(sale.id, 'refunded')}
                            >
                              <RefreshCcw size={12} /> Reembolsar
                            </Button>
                          </>
                        )}
                        {sale.status !== 'completed' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 px-2 text-[10px] gap-1"
                            onClick={() => updateStatus(sale.id, 'completed')}
                          >
                            <CheckCircle2 size={12} /> Restaurar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
