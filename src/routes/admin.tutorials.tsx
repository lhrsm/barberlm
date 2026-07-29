import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  GraduationCap, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  Play, 
  FileText, 
  ExternalLink,
  Search,
  Settings,
  Star,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/tutorials")({
  component: AdminTutorials,
});

function AdminTutorials() {
  const queryClient = useQueryClient();
  const [isNewTutorialOpen, setIsNewTutorialOpen] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<any>(null);
  
  // Queries
  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ["admin-tutorial-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_categories")
        .select("*")
        .order("order", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: tutorials, isLoading: tutsLoading } = useQuery({
    queryKey: ["admin-tutorials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorials")
        .select(`
          *,
          category:tutorial_categories(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: onboardingSettings } = useQuery({
    queryKey: ["admin-onboarding-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_settings")
        .select("*")
        .single();
      if (error) return null;
      return data;
    }
  });

  // Mutations
  const createTutorialMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from("tutorials")
        .insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tutorials"] });
      setIsNewTutorialOpen(false);
      toast.success("Tutorial criado com sucesso!");
    }
  });

  const updateTutorialMutation = useMutation({
    mutationFn: async ({ id, ...values }: any) => {
      const { error } = await supabase
        .from("tutorials")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tutorials"] });
      setEditingTutorial(null);
      toast.success("Tutorial atualizado!");
    }
  });

  const deleteTutorialMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tutorials")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tutorials"] });
      toast.success("Tutorial excluído");
    }
  });

  const updateOnboardingMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from("onboarding_settings")
        .upsert({ id: onboardingSettings?.id, ...values });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-onboarding-settings"] });
      toast.success("Configurações de onboarding salvas!");
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Central de Aprendizado</h2>
          <p className="text-gray-400">Gerencie tutoriais, guias e o onboarding da plataforma.</p>
        </div>
        <Button onClick={() => setIsNewTutorialOpen(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus size={18} className="mr-2" /> Novo Tutorial
        </Button>
      </div>

      <Tabs defaultValue="tutorials" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger value="tutorials" className="data-[state=active]:bg-purple-600">
            Tutoriais
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="data-[state=active]:bg-purple-600">
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-purple-600">
            Categorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tutorials" className="space-y-4">
          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Gerenciar Conteúdo</CardTitle>
              <CardDescription>Crie e edite os tutoriais visíveis para os administradores das barbearias.</CardDescription>
            </CardHeader>
            <CardContent>
              {tutsLoading ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="animate-spin text-purple-500" />
                </div>
              ) : (
                <div className="grid gap-4">
                  {tutorials?.map((tutorial) => (
                    <div 
                      key={tutorial.id} 
                      className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-white/5 flex items-center justify-center text-purple-400">
                          {tutorial.type === 'video' ? <Play size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{tutorial.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] border-white/10 text-gray-500">
                              {tutorial.category?.name || "Sem Categoria"}
                            </Badge>
                            {tutorial.is_featured && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setEditingTutorial(tutorial)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (confirm("Excluir este tutorial?")) {
                              deleteTutorialMutation.mutate(tutorial.id);
                            }
                          }}
                          className="text-gray-400 hover:text-rose-500"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-black/40 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Modal de Primeiro Acesso</CardTitle>
                <CardDescription>Configure o vídeo e a mensagem exibidos no primeiro login do usuário.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-white">URL do Vídeo (YouTube/Vimeo)</Label>
                  <Input 
                    defaultValue={onboardingSettings?.video_url || ""} 
                    id="onboarding-video"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Mensagem de Boas-vindas</Label>
                  <Textarea 
                    defaultValue={onboardingSettings?.message || ""} 
                    id="onboarding-message"
                    className="bg-white/5 border-white/10 text-white min-h-[100px]"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    defaultChecked={onboardingSettings?.is_active || false} 
                    id="onboarding-active"
                  />
                  <Label htmlFor="onboarding-active" className="text-white">Ativar Modal Automaticamente</Label>
                </div>
              </CardContent>
              <CardHeader className="pt-0">
                <Button 
                  onClick={() => {
                    const video = (document.getElementById("onboarding-video") as HTMLInputElement).value;
                    const message = (document.getElementById("onboarding-message") as HTMLTextAreaElement).value;
                    const active = (document.getElementById("onboarding-active") as HTMLInputElement).dataset.state === 'checked';
                    updateOnboardingMutation.mutate({ video_url: video, message, is_active: active });
                  }}
                  className="w-fit bg-purple-600"
                >
                  Salvar Alterações
                </Button>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-purple-900/20 to-black border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Preview do Vídeo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-black/40 rounded-lg flex items-center justify-center border border-white/10">
                  <Play size={32} className="text-white/20" />
                </div>
                <p className="mt-4 text-xs text-gray-500 leading-relaxed italic">
                  Este vídeo será exibido em um modal premium para todos os novos administradores que acessarem a plataforma pela primeira vez.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories">
           {/* Placeholder for categories management, could follow same pattern */}
           <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Categorias de Tutorial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500 italic">
                Gerenciamento de categorias em breve.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New/Edit Tutorial Dialog */}
      <Dialog 
        open={isNewTutorialOpen || !!editingTutorial} 
        onOpenChange={(open) => {
          if (!open) {
            setIsNewTutorialOpen(false);
            setEditingTutorial(null);
          }
        }}
      >
        <DialogContent className="bg-[#0c0c0c] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTutorial ? "Editar Tutorial" : "Novo Tutorial"}</DialogTitle>
            <DialogDescription>Preencha os dados do tutorial abaixo.</DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data = Object.fromEntries(formData.entries());
            const values = {
              ...data,
              is_featured: formData.get("is_featured") === "on",
              order: parseInt(data.order as string) || 0
            };

            if (editingTutorial) {
              updateTutorialMutation.mutate({ id: editingTutorial.id, ...values });
            } else {
              createTutorialMutation.mutate(values);
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                name="title" 
                defaultValue={editingTutorial?.title || ""} 
                className="bg-white/5 border-white/10" 
                required 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select name="category_id" defaultValue={editingTutorial?.category_id} required>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 text-white">
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select name="type" defaultValue={editingTutorial?.type || "video"} required>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 text-white">
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="link">Link Externo</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>URL do Conteúdo (Vídeo ou Arquivo)</Label>
              <Input 
                name="content_url" 
                defaultValue={editingTutorial?.content_url || ""} 
                className="bg-white/5 border-white/10" 
                required 
              />
            </div>

            <div className="space-y-2">
              <Label>Thumbnail (Opcional)</Label>
              <Input 
                name="thumbnail_url" 
                defaultValue={editingTutorial?.thumbnail_url || ""} 
                className="bg-white/5 border-white/10" 
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                name="description" 
                defaultValue={editingTutorial?.description || ""} 
                className="bg-white/5 border-white/10 min-h-[80px]" 
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch name="is_featured" defaultChecked={editingTutorial?.is_featured || false} />
              <Label>Destacar Tutorial</Label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => {
                setIsNewTutorialOpen(false);
                setEditingTutorial(null);
              }}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-purple-600">
                {editingTutorial ? "Salvar" : "Criar Tutorial"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
