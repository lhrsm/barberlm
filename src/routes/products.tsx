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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  const [productsTab, setProductsTab] = useState<string>("inventory");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProductId) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest?.('[data-product-card]')) setActiveProductId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [activeProductId]);
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
      promotional_price: product.promotional_price,
      stock_quantity: product.stock_quantity,
      description: product.description,
      short_description: product.short_description,
      category: product.category,
      brand: product.brand,
      image_url: product.image_url,
      featured: false,
      badge: product.badge,
      user_id: user.id,
    } as any);

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
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {/* HEADER */}
          <header className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
                <ShoppingBag className="h-7 w-7 text-[#f59e0b]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate">Produtos</h1>
                <p className="text-sm text-zinc-400 mt-1 truncate">
                  Gerencie seu estoque de pomadas, balms e outros itens premium.
                </p>
              </div>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) setEditingProduct(null);
            }}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => setEditingProduct(null)}
                  className="h-[42px] px-[18px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.45)] transition-all hover:-translate-y-0.5 w-full sm:w-auto"
                >
                  <Plus size={18} className="mr-2" /> Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0b0f17] border-zinc-800 text-white">
                {canAddProduct || editingProduct ? (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold">{editingProduct ? "Editar Produto" : "Adicionar Novo Produto"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddProduct} className="space-y-6 pt-4">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex flex-col items-center justify-center">
                            <div className="relative w-full aspect-square border-2 border-dashed border-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden bg-[#05070d] hover:border-[#f59e0b]/40 transition-colors">
                              {(editingProduct?.image_url || newProduct.image_url) ? (
                                <img src={editingProduct?.image_url || newProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-center p-4">
                                  <ImageIcon className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
                                  <p className="text-xs text-zinc-400">Arraste ou clique para enviar</p>
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
                            <p className="text-[10px] text-zinc-400 mt-2 uppercase font-bold tracking-widest">{uploading ? "Enviando imagem..." : "Imagem Principal"}</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="category" className="text-xs font-bold uppercase tracking-widest text-zinc-400">Categoria</Label>
                            <Select
                              value={editingProduct ? editingProduct.category : newProduct.category}
                              onValueChange={(val) => editingProduct ? setEditingProduct({...editingProduct, category: val}) : setNewProduct({...newProduct, category: val})}
                            >
                              <SelectTrigger className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800">
                                <SelectValue placeholder="Selecione uma categoria" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#0b0f17] border-zinc-800 text-white">
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
                            <Label htmlFor="brand" className="text-xs font-bold uppercase tracking-widest text-zinc-400">Marca</Label>
                            <Input
                              id="brand"
                              placeholder="Ex: Reuzel, Suavecito"
                              value={editingProduct ? editingProduct.brand : newProduct.brand}
                              onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, brand: e.target.value}) : setNewProduct({...newProduct, brand: e.target.value})}
                              className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-zinc-400">Nome do Produto</Label>
                            <Input
                              id="name"
                              placeholder="Pomada Modeladora Efeito Matte"
                              value={editingProduct ? editingProduct.name : newProduct.name}
                              onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, name: e.target.value}) : setNewProduct({...newProduct, name: e.target.value})}
                              required
                              className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="price" className="text-xs font-bold uppercase tracking-widest text-zinc-400">Preço (R$)</Label>
                              <Input
                                id="price" type="number" step="0.01" placeholder="0.00"
                                value={editingProduct ? editingProduct.price : newProduct.price}
                                onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, price: e.target.value}) : setNewProduct({...newProduct, price: e.target.value})}
                                required
                                className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="promo" className="text-xs font-bold uppercase tracking-widest text-zinc-400">Promo (R$)</Label>
                              <Input
                                id="promo" type="number" step="0.01" placeholder="Opcional"
                                value={editingProduct ? editingProduct.promotional_price : newProduct.promotional_price}
                                onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, promotional_price: e.target.value}) : setNewProduct({...newProduct, promotional_price: e.target.value})}
                                className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="stock" className="text-xs font-bold uppercase tracking-widest text-zinc-400">Estoque</Label>
                              <Input
                                id="stock" type="number"
                                value={editingProduct ? editingProduct.stock_quantity : newProduct.stock_quantity}
                                onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, stock_quantity: e.target.value}) : setNewProduct({...newProduct, stock_quantity: e.target.value})}
                                required
                                className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="badge" className="text-xs font-bold uppercase tracking-widest text-zinc-400">Selo (Badge)</Label>
                              <Select
                                value={editingProduct ? editingProduct.badge : newProduct.badge}
                                onValueChange={(val) => editingProduct ? setEditingProduct({...editingProduct, badge: val}) : setNewProduct({...newProduct, badge: val})}
                              >
                                <SelectTrigger className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800">
                                  <SelectValue placeholder="Sem selo" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0b0f17] border-zinc-800 text-white">
                                  <SelectItem value="Mais vendido">Mais vendido</SelectItem>
                                  <SelectItem value="Novo">Novo</SelectItem>
                                  <SelectItem value="Premium">Premium</SelectItem>
                                  <SelectItem value="Oferta">Oferta</SelectItem>
                                  <SelectItem value="Exclusivo">Exclusivo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-[#05070d] rounded-xl border border-zinc-800">
                            <div className="space-y-0.5">
                              <Label className="text-sm font-bold text-white">Produto em Destaque</Label>
                              <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Aparece no topo da vitrine</p>
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
                          <Label htmlFor="short_desc" className="text-xs font-bold uppercase tracking-widest text-zinc-400">Breve Descrição (Vitrine)</Label>
                          <Input
                            id="short_desc"
                            placeholder="Ex: Fixação forte com brilho natural."
                            value={editingProduct ? editingProduct.short_description : newProduct.short_description}
                            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, short_description: e.target.value}) : setNewProduct({...newProduct, short_description: e.target.value})}
                            className="h-[42px] rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description" className="text-xs font-bold uppercase tracking-widest text-zinc-400">Descrição Detalhada</Label>
                          <Textarea
                            id="description"
                            placeholder="Fale sobre os benefícios, modo de uso e diferenciais do produto..."
                            value={editingProduct ? editingProduct.description : newProduct.description}
                            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, description: e.target.value}) : setNewProduct({...newProduct, description: e.target.value})}
                            className="rounded-xl min-h-[120px] resize-none bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={uploading}
                        className="w-full h-[42px] px-[18px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.45)] transition-all"
                      >
                        {editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="space-y-4 py-4">
                    <Alert className="bg-red-500/10 border-red-500/30 text-red-300">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <AlertTitle>Limite Atingido</AlertTitle>
                      <AlertDescription>
                        Seu plano atual permite apenas {limits.products} produtos. Faça o upgrade para adicionar mais.
                      </AlertDescription>
                    </Alert>
                    <Button asChild className="w-full h-[42px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-white font-bold">
                      <Link to="/subscription">Ver Planos</Link>
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </header>

          {!canAddProduct && (
            <Alert className="bg-[#0b0f17] border-[#f59e0b]/30 text-zinc-300">
              <Crown className="h-4 w-4 text-[#f59e0b]" />
              <AlertTitle className="text-white">Limite de Produtos</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                Você atingiu o limite de {limits.products} produtos do seu plano.
                <Button variant="link" size="sm" asChild className="p-0 h-auto text-[#f59e0b] hover:text-[#fbbf24]">
                  <Link to="/subscription">Fazer Upgrade</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={productsTab} onValueChange={setProductsTab} className="w-full">
            {/* Desktop tabs */}
            <TabsList className="hidden md:inline-flex bg-[#0b0f17] border border-zinc-800/80 rounded-xl p-1 h-auto">
              <TabsTrigger value="inventory" className="gap-2 h-10 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#f59e0b] data-[state=active]:to-[#ea580c] data-[state=active]:text-white text-zinc-400">
                <Package size={16} /> Estoque
              </TabsTrigger>
              <TabsTrigger value="billing" className="gap-2 h-10 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#f59e0b] data-[state=active]:to-[#ea580c] data-[state=active]:text-white text-zinc-400">
                <History size={16} /> Faturamento
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2 h-10 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#f59e0b] data-[state=active]:to-[#ea580c] data-[state=active]:text-white text-zinc-400">
                <History size={16} /> Histórico
              </TabsTrigger>
            </TabsList>

            {/* Mobile accordion */}
            <div className="md:hidden">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="tabs" className="border border-zinc-800/80 rounded-xl bg-[#0b0f17] overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <span className="flex items-center gap-2 text-white font-semibold text-sm">
                      {productsTab === "inventory" && (<><Package size={16} className="text-[#f59e0b]" /> Estoque</>)}
                      {productsTab === "billing" && (<><History size={16} className="text-[#f59e0b]" /> Faturamento</>)}
                      {productsTab === "history" && (<><History size={16} className="text-[#f59e0b]" /> Histórico</>)}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pb-2">
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { val: "inventory", label: "Estoque", icon: Package },
                        { val: "billing", label: "Faturamento", icon: History },
                        { val: "history", label: "Histórico", icon: History },
                      ].map(({ val, label, icon: Icon }) => (
                        <Button
                          key={val}
                          variant="ghost"
                          onClick={() => setProductsTab(val)}
                          className={cn(
                            "justify-start gap-2 h-11 rounded-lg text-sm font-semibold",
                            productsTab === val
                              ? "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-white hover:from-[#fbbf24] hover:to-[#f59e0b] hover:text-white"
                              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
                          )}
                        >
                          <Icon size={16} /> {label}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>


            <TabsContent value="inventory" className="pt-6">
              <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-4 sm:p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                  <h3 className="font-bold flex items-center gap-2 text-white">
                    <LayoutGrid className="h-5 w-5 text-[#f59e0b]" />
                    Vitrine de Produtos
                  </h3>
                  <span className="text-xs text-zinc-400">{products.length} {products.length === 1 ? "produto" : "produtos"}</span>
                </div>

                {products.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-[#05070d] border-zinc-800">
                    <ShoppingBag className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                    <h4 className="text-lg font-bold">Sua vitrine está vazia</h4>
                    <p className="text-zinc-400 text-sm max-w-xs mx-auto mt-2">
                      Cadastre seus produtos premium para que seus clientes possam vê-los.
                    </p>
                    <Button
                      onClick={() => setIsAddDialogOpen(true)}
                      className="mt-6 h-[42px] px-[18px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
                    >
                      <Plus size={18} className="mr-2" /> Adicionar Primeiro Produto
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {products.map((product) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative bg-[#05070d] border border-zinc-800 rounded-2xl overflow-hidden hover:border-[#f59e0b]/40 hover:shadow-[0_8px_32px_rgba(245,158,11,0.15)] transition-all duration-300"
                        data-product-card
                      >
                        <div
                          className="aspect-[4/3] sm:aspect-square bg-[#0b0f17] relative overflow-hidden cursor-pointer"
                          onClick={(e) => {
                            // ignore clicks originating from action buttons
                            if ((e.target as HTMLElement).closest('[data-product-action]')) return;
                            setActiveProductId((prev) => (prev === product.id ? null : product.id));
                          }}
                        >
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-20 h-20 text-zinc-700" />
                            </div>
                          )}

                          {product.badge && (
                            <div className="absolute top-3 left-3 bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg z-10">
                              {product.badge}
                            </div>
                          )}

                          {product.featured && (
                            <div className="absolute top-3 right-3 bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-md z-10 flex items-center gap-1">
                              <Star size={10} fill="currentColor" /> Destaque
                            </div>
                          )}

                          <div
                            className={`absolute inset-0 bg-black/60 transition-opacity duration-300 flex items-center justify-center gap-2 group-hover:opacity-100 ${
                              activeProductId === product.id ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:pointer-events-auto'
                            }`}
                          >
                            <Button
                              data-product-action
                              size="icon"
                              className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveProductId(null);
                                setEditingProduct(product);
                                setIsAddDialogOpen(true);
                              }}
                              title="Editar"
                            >
                              <Edit size={18} />
                            </Button>
                            <Button
                              data-product-action
                              size="icon"
                              className="h-11 w-11 rounded-xl bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 text-[#f59e0b] border border-[#f59e0b]/40 backdrop-blur-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveProductId(null);
                                handleDuplicateProduct(product);
                              }}
                              title="Duplicar"
                            >
                              <Copy size={18} />
                            </Button>
                            <Button
                              data-product-action
                              size="icon"
                              className="h-11 w-11 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 backdrop-blur-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveProductId(null);
                                handleDeleteProduct(product.id);
                              }}
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </Button>
                          </div>

                          {product.stock_quantity <= 5 && (
                            <div className="absolute bottom-3 left-3 right-3 bg-red-500/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest py-1.5 rounded-lg text-center shadow-lg">
                              Estoque Crítico: {product.stock_quantity}
                            </div>
                          )}
                        </div>

                        <div className="p-4 sm:p-5 space-y-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b]">{product.category}</p>
                            <h3 className="font-bold text-lg text-white truncate" title={product.name}>{product.name}</h3>
                            {product.brand && <p className="text-xs font-medium text-zinc-500">{product.brand}</p>}
                          </div>

                          <div className="flex items-end justify-between gap-3">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-2xl font-black text-white">R$ {Number(product.price).toFixed(2)}</span>
                                {product.promotional_price && (
                                  <span className="text-xs text-zinc-500 line-through font-medium">R$ {Number(product.promotional_price).toFixed(2)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">
                                <Package size={10} />
                                <span>{product.stock_quantity} un.</span>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              className="h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] gap-2 shrink-0"
                              onClick={async () => {
                                if (!user) return;
                                if (product.stock_quantity <= 0) {
                                  toast.error("Produto sem estoque!");
                                  return;
                                }
                                try {
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
                      </motion.div>
                    ))}
                  </div>
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

  if (loading) return <div className="text-center py-12 text-zinc-400">Carregando histórico...</div>;

  return (
    <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-6 space-y-5">
      <div className="border-b border-zinc-800/80 pb-4">
        <h3 className="font-bold flex items-center gap-2 text-white">
          <History className="h-5 w-5 text-[#f59e0b]" />
          {onlyCompleted ? "Faturamento de Produtos" : "Histórico de Vendas"}
        </h3>
        <p className="text-sm text-zinc-400 mt-1">
          {onlyCompleted
            ? "Acompanhe suas vendas concluídas (exclui cancelamentos e reembolsos)."
            : "Acompanhe todas as suas vendas, incluindo cancelamentos e reembolsos."}
        </p>
      </div>

      {sales.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-[#05070d] border-zinc-800">
          <History className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-white">Nenhuma venda registrada</h4>
          <p className="text-zinc-400 text-sm mt-2">Suas vendas aparecerão aqui.</p>
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase tracking-widest bg-[#05070d] text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-bold">Data</th>
                <th className="px-4 py-3 font-bold">Itens</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-t border-zinc-800 text-zinc-300 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">
                    {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-[200px] truncate">
                      {sale.items.map((item: any) => `${item.name} (x${item.quantity})`).join(", ")}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-bold text-white">
                    R$ {sale.total_amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                      sale.status === 'completed' && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                      sale.status === 'cancelled' && "bg-red-500/15 text-red-400 border-red-500/30",
                      sale.status === 'refunded' && "bg-amber-500/15 text-amber-400 border-amber-500/30"
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
                            size="sm"
                            className="h-8 px-3 text-[10px] gap-1 rounded-lg bg-transparent border border-zinc-800 text-zinc-300 hover:text-white hover:border-red-500/40 hover:bg-red-500/5"
                            onClick={() => updateStatus(sale.id, 'cancelled')}
                          >
                            <XCircle size={12} /> Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-3 text-[10px] gap-1 rounded-lg bg-transparent border border-zinc-800 text-zinc-300 hover:text-white hover:border-amber-500/40 hover:bg-amber-500/5"
                            onClick={() => updateStatus(sale.id, 'refunded')}
                          >
                            <RefreshCcw size={12} /> Reembolsar
                          </Button>
                        </>
                      )}
                      {sale.status !== 'completed' && (
                        <Button
                          size="sm"
                          className="h-8 px-3 text-[10px] gap-1 rounded-lg bg-transparent border border-zinc-800 text-zinc-300 hover:text-white hover:border-emerald-500/40 hover:bg-emerald-500/5"
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
    </div>
  );
}
