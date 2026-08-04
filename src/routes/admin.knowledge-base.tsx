import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  GraduationCap, Plus, Trash2, Edit, Save, X, Play, FileText, 
  Search, Settings, Star, CheckCircle2, Loader2, History, 
  BarChart3, Layout, Layers, BookOpen, MessageSquare, AlertCircle,
  Eye, ThumbsUp, Clock, User, ChevronRight, Filter, Rocket,
  Megaphone, Bell
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { adminSaveTutorial, adminSaveAcademyLesson } from "@/lib/knowledge-base.functions";
import { adminSaveUpdate } from "@/lib/changelog.functions";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";



export const Route = createFileRoute("/admin/knowledge-base")({
  component: KnowledgeBaseAdmin,
});

function KnowledgeBaseAdmin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("tutorials");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isUpdateEditorOpen, setIsUpdateEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingUpdate, setEditingUpdate] = useState<any>(null);
  const [contentType, setContentType] = useState<"tutorial" | "lesson">("tutorial");
  
  const saveTutorial = useServerFn(adminSaveTutorial);
  const saveLesson = useServerFn(adminSaveAcademyLesson);
  const saveUpdate = useServerFn(adminSaveUpdate);


  // Queries
  const { data: categories } = useQuery({
    queryKey: ["admin-tutorial-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tutorial_categories").select("*").order("order");
      if (error) throw error;
      return data;
    }
  });

  const { data: tutorials, isLoading: tutsLoading } = useQuery({
    queryKey: ["admin-tutorials-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tutorials").select("*, category:tutorial_categories(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: changelog, isLoading: updatesLoading } = useQuery({
    queryKey: ["admin-changelog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("changelog_entries").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: analytics } = useQuery({

    queryKey: ["admin-content-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_analytics").select("*");
      if (error) throw error;
      return data;
    }
  });

  const getAnalytics = (type: string, id: string) => analytics?.find(a => a.content_type === type && a.content_id === id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">
            Knowledge <span className="text-gold">Base Admin</span>
          </h2>
          <p className="text-zinc-400">Gestão centralizada de tutoriais, artigos e trilhas da Academia Barbex.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              if (activeTab === 'changelog') {
                setEditingUpdate(null);
                setIsUpdateEditorOpen(true);
              } else {
                setContentType("tutorial");
                setEditingItem(null);
                setIsEditorOpen(true);
              }
            }} 
            variant="gold" 
            className="rounded-xl font-bold"
          >
            <Plus size={18} className="mr-2" /> Novo {activeTab === 'changelog' ? 'Update' : 'Artigo'}
          </Button>
        </div>

      </div>

      <Tabs defaultValue="tutorials" onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900/50 border border-white/5 p-1 rounded-2xl">
          <TabsTrigger value="tutorials" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black px-6 font-bold">
            Artigos & Tutoriais
          </TabsTrigger>
          <TabsTrigger value="academy" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black px-6 font-bold">
            Trilhas Academia
          </TabsTrigger>
          <TabsTrigger value="changelog" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black px-6 font-bold">
            Changelog & Novidades
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black px-6 font-bold">
            Analytics
          </TabsTrigger>

          <TabsTrigger value="workflow" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black px-6 font-bold">
            Workflow & Versões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tutorials" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
             <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-sm">
               <CardHeader className="pb-2">
                 <CardDescription className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Total Artigos</CardDescription>
                 <CardTitle className="text-2xl text-white">{tutorials?.length || 0}</CardTitle>
               </CardHeader>
             </Card>
             <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-sm">
               <CardHeader className="pb-2">
                 <CardDescription className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Publicados</CardDescription>
                 <CardTitle className="text-2xl text-green-500">{tutorials?.filter(t => t.status === 'published').length || 0}</CardTitle>
               </CardHeader>
             </Card>
             <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-sm">
               <CardHeader className="pb-2">
                 <CardDescription className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Em Revisão</CardDescription>
                 <CardTitle className="text-2xl text-yellow-500">{tutorials?.filter(t => t.status === 'review').length || 0}</CardTitle>
               </CardHeader>
             </Card>
             <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-sm">
               <CardHeader className="pb-2">
                 <CardDescription className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Visualizações</CardDescription>
                 <CardTitle className="text-2xl text-gold">{analytics?.reduce((acc, a) => acc + (a.views_count || 0), 0) || 0}</CardTitle>
               </CardHeader>
             </Card>
          </div>

          <div className="grid gap-4">
            {tutsLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin text-gold" /></div>
            ) : (
              tutorials?.map((tutorial) => (
                <Card key={tutorial.id} className="bg-zinc-900/40 border-white/5 hover:bg-zinc-800/40 transition-all overflow-hidden group">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row items-center">
                      <div className="w-full md:w-48 h-32 bg-zinc-800 relative overflow-hidden flex-shrink-0">
                        {tutorial.thumbnail_url ? (
                          <img src={tutorial.thumbnail_url} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700">
                             {tutorial.type === 'video' ? <Play size={40} /> : <FileText size={40} />}
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                           <Badge className={cn(
                             "rounded-md text-[10px] uppercase font-black",
                             tutorial.status === 'published' ? "bg-green-500/20 text-green-500 border-green-500/20" : 
                             tutorial.status === 'review' ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/20" : "bg-zinc-500/20 text-zinc-400 border-zinc-500/20"
                           )}>
                             {tutorial.status || 'draft'}
                           </Badge>
                        </div>
                      </div>
                      <div className="flex-1 p-6 flex flex-col md:flex-row justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                             <span className="text-gold text-[10px] font-black tracking-widest uppercase">v{tutorial.version || 1}</span>
                             <span className="text-zinc-600">•</span>
                             <span className="text-zinc-400 text-[10px] font-bold uppercase">{tutorial.category?.name || "Geral"}</span>
                          </div>
                          <h4 className="text-xl font-bold text-white group-hover:text-gold transition-colors">{tutorial.title}</h4>
                          <p className="text-zinc-500 text-sm line-clamp-1 mt-1">{tutorial.description}</p>
                          <div className="flex items-center gap-4 mt-4 text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">
                             <div className="flex items-center gap-1"><Eye size={12} /> {getAnalytics('tutorial', tutorial.id)?.views_count || 0}</div>
                             <div className="flex items-center gap-1"><ThumbsUp size={12} /> {getAnalytics('tutorial', tutorial.id)?.helpful_count || 0}</div>
                             <div className="flex items-center gap-1"><Clock size={12} /> {format(new Date(tutorial.created_at), "dd MMM yyyy", { locale: ptBR })}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="rounded-xl border-white/5 hover:bg-zinc-800" onClick={() => {
                            setEditingItem(tutorial);
                            setContentType("tutorial");
                            setIsEditorOpen(true);
                          }}>
                            <Edit size={16} className="text-zinc-400" />
                          </Button>
                          <Button variant="outline" size="icon" className="rounded-xl border-white/5 hover:bg-rose-500/20 hover:border-rose-500/50 group/del">
                            <Trash2 size={16} className="text-zinc-600 group-hover/del:text-rose-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="changelog" className="space-y-4">
          <div className="grid gap-4">
            {updatesLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin text-gold" /></div>
            ) : (
              changelog?.map((update) => (
                <Card key={update.id} className="bg-zinc-900/40 border-white/5 hover:bg-zinc-800/40 transition-all overflow-hidden group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                           <Rocket size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                             <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 border-white/5">
                               v{update.version_tag || '1.0'}
                             </Badge>
                             <Badge className={cn(
                               "text-[9px] uppercase font-black",
                               update.status === 'published' ? "bg-green-500/20 text-green-500" : "bg-zinc-500/20 text-zinc-400"
                             )}>
                               {update.status}
                             </Badge>
                          </div>
                          <h4 className="text-lg font-bold text-white group-hover:text-gold transition-colors">{update.title}</h4>
                          <p className="text-zinc-500 text-xs mt-1">{format(new Date(update.created_at), "dd MMM yyyy HH:mm")}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                         <Button variant="outline" size="icon" className="rounded-xl border-white/5" onClick={() => {
                           setEditingUpdate(update);
                           setIsUpdateEditorOpen(true);
                         }}>
                           <Edit size={16} />
                         </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">

           <Card className="bg-zinc-900/40 border-white/5">
             <CardHeader>
               <CardTitle className="text-white">Performance de Conteúdo</CardTitle>
               <CardDescription>Métricas de engajamento e utilidade dos artigos.</CardDescription>
             </CardHeader>
             <CardContent>
                <div className="text-zinc-500 italic text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                  Dashboard de Analytics em construção com dados reais do content_analytics.
                </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Editor Modal (Skeleton/Structure) */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="bg-zinc-950 border-white/5 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase italic">
              {editingItem ? "Editar" : "Novo"} <span className="text-gold">{contentType === 'tutorial' ? 'Artigo' : 'Aula'}</span>
            </DialogTitle>
          </DialogHeader>
          
          <form className="space-y-6 pt-4" onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data = Object.fromEntries(formData.entries());
            
            try {
              if (contentType === 'tutorial') {
                await saveTutorial({ 
                  data: {
                    id: editingItem?.id, 
                    ...data,
                    status: data.status || 'draft',
                    is_featured: formData.get("is_featured") === "on"
                  }
                });
              }
              toast.success("Conteúdo salvo com sucesso!");

              setIsEditorOpen(false);
              queryClient.invalidateQueries({ queryKey: ["admin-tutorials-full"] });
            } catch (err: any) {
              toast.error(err.message);
            }
          }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Título do Artigo</Label>
                  <Input name="title" defaultValue={editingItem?.title} placeholder="Como configurar o PIX..." className="bg-zinc-900/50 border-white/5 rounded-xl h-12" required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Categoria</Label>
                    <Select name="category_id" defaultValue={editingItem?.category_id}>
                      <SelectTrigger className="bg-zinc-900/50 border-white/5 rounded-xl h-12">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-white/5 text-white">
                        {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</Label>
                    <Select name="status" defaultValue={editingItem?.status || "draft"}>
                      <SelectTrigger className="bg-zinc-900/50 border-white/5 rounded-xl h-12 text-gold font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-white/5 text-white">
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="review">Em Revisão</SelectItem>
                        <SelectItem value="published">Publicado</SelectItem>
                        <SelectItem value="archived">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">URL do Vídeo / Conteúdo</Label>
                   <Input name="content_url" defaultValue={editingItem?.content_url} placeholder="https://youtube.com/..." className="bg-zinc-900/50 border-white/5 rounded-xl h-12" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Resumo / Descrição Curta</Label>
                  <Textarea name="description" defaultValue={editingItem?.description} className="bg-zinc-900/50 border-white/5 rounded-xl min-h-[100px]" placeholder="Breve introdução ao conteúdo..." />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Thumbnail URL</Label>
                  <Input name="thumbnail_url" defaultValue={editingItem?.thumbnail_url} className="bg-zinc-900/50 border-white/5 rounded-xl h-12" />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Switch name="is_featured" defaultChecked={editingItem?.is_featured} />
                  <Label className="font-bold text-white">Destacar na Central de Ajuda</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Motivo da Alteração (para Versionamento)</Label>
               <Input name="change_reason" placeholder="Atualização de UI, correção de passos..." className="bg-zinc-900/50 border-white/5 rounded-xl" />
            </div>

            <DialogFooter className="border-t border-white/5 pt-6 gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditorOpen(false)} className="rounded-xl">Cancelar</Button>
              <Button type="submit" variant="gold" className="rounded-xl font-bold px-8">Salvar Conteúdo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Editor Modal */}
      <Dialog open={isUpdateEditorOpen} onOpenChange={setIsUpdateEditorOpen}>
        <DialogContent className="bg-zinc-950 border-white/5 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase italic">
              {editingUpdate ? "Editar" : "Novo"} <span className="text-gold">Update</span>
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4 pt-4" onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data = Object.fromEntries(formData.entries());
            try {
              await saveUpdate({ 
                data: {
                  id: editingUpdate?.id,
                  ...data,
                  is_beta: formData.get("is_beta") === "on",
                  requires_action: formData.get("requires_action") === "on"
                }
              });
              toast.success("Update salvo!");
              setIsUpdateEditorOpen(false);
              queryClient.invalidateQueries({ queryKey: ["admin-changelog"] });
            } catch (err: any) {
              toast.error(err.message);
            }
          }}>
            <div className="space-y-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Título da Novidade</Label>
                  <Input name="title" defaultValue={editingUpdate?.title} className="bg-zinc-900/50 border-white/5 rounded-xl" required />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Versão</Label>
                    <Input name="version_tag" defaultValue={editingUpdate?.version_tag} placeholder="1.2" className="bg-zinc-900/50 border-white/5 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</Label>
                    <Select name="status" defaultValue={editingUpdate?.status || "draft"}>
                      <SelectTrigger className="bg-zinc-900/50 border-white/5 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-white/5 text-white">
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="published">Publicado</SelectItem>
                        <SelectItem value="archived">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Resumo</Label>
                  <Textarea name="summary" defaultValue={editingUpdate?.summary} className="bg-zinc-900/50 border-white/5 rounded-xl" />
               </div>
            </div>
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={() => setIsUpdateEditorOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="gold" className="rounded-xl font-bold">Publicar Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

