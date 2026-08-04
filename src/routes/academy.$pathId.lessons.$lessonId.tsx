import { createFileRoute } from "@tanstack/react-router";
import { AcademyLayout } from "@/components/academy/AcademyLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAcademyPathDetails, markLessonProgress } from "@/lib/academy.functions";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Play, 
  ExternalLink,
  BookOpen,
  CheckSquare
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/academy/$pathId/lessons/$lessonId")({
  component: LessonContentPage,
});

function LessonContentPage() {
  const { pathId, lessonId } = Route.useParams();
  const queryClient = useQueryClient();
  const [activeChecklist, setActiveChecklist] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["academy-path", pathId],
    queryFn: () => getAcademyPathDetails({ data: { pathId } })
  });

  const progressMutation = useMutation({
    mutationFn: (status: "started" | "completed") => 
      markLessonProgress({ data: { pathId, lessonId, status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-path", pathId] });
    }
  });

  if (isLoading || !data) return null;

  const { path, modules } = data as any;
  
  // Find current lesson and its siblings for navigation
  let currentLesson: any = null;
  let prevLesson: any = null;
  let nextLesson: any = null;
  
  const allLessons = modules.flatMap((m: any) => m.lessons);
  const currentIndex = allLessons.findIndex((l: any) => l.id === lessonId);
  
  if (currentIndex !== -1) {
    currentLesson = allLessons[currentIndex];
    prevLesson = allLessons[currentIndex - 1];
    nextLesson = allLessons[currentIndex + 1];
  }

  if (!currentLesson) return <div>Aula não encontrada.</div>;

  const isCompleted = currentLesson.progress === 'completed';

  const handleComplete = () => {
    progressMutation.mutate("completed");
    toast.success("Aula concluída! Parabéns pelo progresso.");
  };

  const toggleChecklist = (item: string) => {
    setActiveChecklist(prev => ({ ...prev, [item]: !prev[item] }));
  };

  return (
    <AcademyLayout 
      breadcrumb={[
        { label: path.name, href: `/academy/${pathId}` as any },
        { label: currentLesson.title }
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-8 pb-32">
        {/* Navigation Top */}
        <div className="flex items-center justify-between gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
          <Link to="/academy/$pathId" params={{ pathId } as any}>
            <Button variant="ghost" size="sm" className="text-white/40 hover:text-white font-bold uppercase tracking-widest text-[10px]">
              <ArrowLeft className="w-3.5 h-3.5 mr-2" />
              Ver Grade
            </Button>
          </Link>
          
          <div className="flex items-center gap-2">
            {prevLesson && (
              <Link to="/academy/$pathId/lessons/$lessonId" params={{ pathId, lessonId: prevLesson.id } as any}>
                <Button variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10 h-9 px-4 rounded-xl text-xs font-bold">
                  Anterior
                </Button>
              </Link>
            )}
            {nextLesson && (
              <Link to="/academy/$pathId/lessons/$lessonId" params={{ pathId, lessonId: nextLesson.id } as any}>
                <Button className="bg-gold text-black hover:bg-gold/80 h-9 px-4 rounded-xl text-xs font-bold">
                  Próxima Aula
                  <ArrowRight className="w-3.5 h-3.5 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Lesson Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <span className="px-2 py-0.5 rounded-md bg-gold/10 border border-gold/20 text-[10px] font-black uppercase tracking-widest text-gold">
              Aula {currentIndex + 1}
            </span>
            {isCompleted && (
              <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Concluída
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
            {currentLesson.title}
          </h1>
          <p className="text-white/50 text-lg font-medium leading-relaxed">
            {currentLesson.summary}
          </p>
        </div>

        {/* Video Placeholder or Real Video */}
        {currentLesson.video_url ? (
          <div className="aspect-video rounded-[32px] overflow-hidden bg-black border border-white/5 shadow-2xl group relative">
            <iframe 
              src={currentLesson.video_url} 
              className="w-full h-full"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="aspect-video rounded-[32px] overflow-hidden bg-[#0A1020] border border-white/5 flex flex-col items-center justify-center gap-4 text-white/20">
            <Play className="w-16 h-16 opacity-50" />
            <span className="text-xs font-bold uppercase tracking-widest">Vídeo aula indisponível</span>
          </div>
        )}

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-8">
            <div className="prose prose-invert max-w-none prose-gold font-medium text-white/70">
              <div dangerouslySetInnerHTML={{ __html: currentLesson.content || 'Sem conteúdo adicional.' }} />
            </div>

            {/* Checklist */}
            {currentLesson.checklist && currentLesson.checklist.length > 0 && (
              <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 space-y-6">
                <h3 className="font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                  <CheckSquare className="text-gold w-6 h-6" />
                  Exercícios Práticos
                </h3>
                <div className="space-y-3">
                  {currentLesson.checklist.map((item: string, i: number) => (
                    <button 
                      key={i}
                      onClick={() => toggleChecklist(item)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                        activeChecklist[item] 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                        : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        activeChecklist[item] ? "bg-emerald-500 border-emerald-500" : "border-white/20"
                      }`}>
                        {activeChecklist[item] && <CheckCircle2 className="w-4 h-4 text-black" />}
                      </div>
                      <span className="text-sm font-bold">{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / Source */}
          <aside className="space-y-6">
             {currentLesson.tutorial_id && (
              <div className="p-6 rounded-[24px] bg-gold/5 border border-gold/20 space-y-4">
                <h4 className="font-black text-gold uppercase text-[10px] tracking-widest">Referência Oficial</h4>
                <p className="text-xs font-medium text-white/60 leading-relaxed">
                  Para mais detalhes técnicos, consulte o artigo oficial na Central de Ajuda.
                </p>
                <Link to="/tutorials">
                   <Button variant="outline" className="w-full h-10 border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 text-xs font-bold rounded-xl">
                    Ver Artigo
                    <ExternalLink className="w-3.5 h-3.5 ml-2" />
                  </Button>
                </Link>
              </div>
            )}

            {currentLesson.route_path && (
              <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
                <h4 className="font-black text-white/40 uppercase text-[10px] tracking-widest">Executar Prática</h4>
                <p className="text-xs font-medium text-white/60 leading-relaxed">
                  Acesse a ferramenta no sistema para realizar os exercícios solicitados.
                </p>
                <Link to={currentLesson.route_path as any}>
                  <Button className="w-full h-10 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl">
                    Ir para Ferramenta
                  </Button>
                </Link>
              </div>
            )}

            {!isCompleted && (
              <Button 
                onClick={handleComplete}
                className="w-full py-8 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-[24px] hover:bg-emerald-400 transition-all shadow-[0_12px_32px_rgba(16,185,129,0.3)]"
              >
                Concluir Aula
              </Button>
            )}
          </div>
        </div>
      </div>
    </AcademyLayout>
  );
}
