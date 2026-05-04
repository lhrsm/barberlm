import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
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
import { ShoppingBag, Plus, Package, AlertTriangle, Crown, Image as ImageIcon, Trash2, Edit, Copy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/products")({
  component: ProductsComponent,
});

function ProductsComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { plan, limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [products, setProducts] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [newProduct, setNewProduct] = useState({ 
    name: "", 
    price: "", 
    stock_quantity: "0", 
    description: "",
    image_url: ""
  });
  
  const canAddProduct = usage.products < limits.products;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchProducts();
  }, [user]);

  async function fetchProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
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
        stock_quantity: parseInt(newProduct.stock_quantity),
        user_id: user.id,
      });

      if (error) {
        toast.error("Erro ao adicionar produto");
      } else {
        toast.success("Produto adicionado com sucesso!");
        setIsAddDialogOpen(false);
        setNewProduct({ name: "", price: "", stock_quantity: "0", description: "", image_url: "" });
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

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
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
            <DialogContent className="max-w-md">
              {canAddProduct || editingProduct ? (
                <>
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? "Editar Produto" : "Adicionar Novo Produto"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddProduct} className="space-y-4 pt-4">
                    <div className="flex flex-col items-center justify-center mb-4">
                      <div className="relative w-32 h-32 border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden bg-muted/30">
                        {(editingProduct?.image_url || newProduct.image_url) ? (
                          <img src={editingProduct?.image_url || newProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-muted-foreground opacity-20" />
                        )}
<Input 
  type="file" 
  accept="image/*" 
  onChange={handleFileUpload}
  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
  disabled={uploading}
/>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{uploading ? "Enviando..." : "Clique para anexar imagem"}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Produto</Label>
                      <Input 
                        id="name" 
                        placeholder="Pomada Modeladora, Balm, etc."
                        value={editingProduct ? editingProduct.name : newProduct.name} 
                        onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, name: e.target.value}) : setNewProduct({...newProduct, name: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Preço de Venda (R$)</Label>
                        <Input 
                          id="price" 
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={editingProduct ? editingProduct.price : newProduct.price} 
                          onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, price: e.target.value}) : setNewProduct({...newProduct, price: e.target.value})} 
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stock">Estoque {editingProduct ? "Atual" : "Inicial"}</Label>
                        <Input 
                          id="stock" 
                          type="number"
                          value={editingProduct ? editingProduct.stock_quantity : newProduct.stock_quantity} 
                          onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, stock_quantity: e.target.value}) : setNewProduct({...newProduct, stock_quantity: e.target.value})} 
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição (Opcional)</Label>
                      <Input 
                        id="description" 
                        value={editingProduct ? editingProduct.description : newProduct.description} 
                        onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, description: e.target.value}) : setNewProduct({...newProduct, description: e.target.value})} 
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={uploading}>
                      {editingProduct ? "Salvar Alterações" : "Salvar Produto"}
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
                  <Button className="w-full" asChild>
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.length === 0 ? (
            <div className="col-span-full text-center py-12 border rounded-xl bg-card text-muted-foreground">
              <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
              <p>Nenhum produto cadastrado ainda.</p>
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className="group relative border rounded-xl bg-card overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className="aspect-square bg-muted/20 relative overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-muted-foreground/20" />
                    </div>
                  )}
                  {product.stock_quantity <= 5 && (
                    <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Estoque Baixo: {product.stock_quantity}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold truncate" title={product.name}>{product.name}</h3>
                    <span className="font-bold text-primary shrink-0">R$ {Number(product.price).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-1">{product.description || "Sem descrição."}</p>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Package size={14} />
                      <span>{product.stock_quantity} un. em estoque</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setEditingProduct(product);
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
