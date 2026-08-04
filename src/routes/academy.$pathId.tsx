import { createFileRoute } from "@tanstack/react-router";
import { AcademyLayout } from "@/components/academy/AcademyLayout";
import { AcademyLessonItem } from "@/components/academy/AcademyComponents";
import { useQuery } from "@tanstack/react-query";
import { getAcademyPathDetails } from "@/lib/academy.functions";
import { Progress } from "@/components/ui/progress";
import { Clock, Signal, Trophy, CheckCircle2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/academy/$pathId")({
  component: PathDetailsPage,
});

function PathDetailsPage() {
  const { pathId } = Route.useParams();
  
  const { data, isLoading } = useQuery({
    queryKey: ["academy-path", pathId],
    queryFn: () => getAcademyPathDetails({ data: { pathId } })
  });

  if (isLoading || !data) {
    return (
      <AcademyLayout breadcrumb={[{ label: "Carregando..." }]}>
        <div className="animate-pulse space-y-8">
          <div className="h-64 bg-white/5 rounded-[32px]" />
          <div className="h-96 bg-white/5 rounded-[32px]" />
        </div>
      </AcademyLayout>
    );
  }

  const { path, modules, stats } = data as any;
  const progressPercent = stats.totalLessons > 0 ? Math.round((stats.completedLessons / stats.totalLessons) * 100) : 0;

  return (
    <AcademyLayout breadcrumb={[{ label: path.name }]}>
      <div className="space-y-8 pb-20">
        {/* Path Hero */}
        <div className="relative overflow-hidden rounded-[32px] bg-[#0A1020] border border-white/5 p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-20 h-20 rounded-3xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
              <Trophy className="w-10 h-10" />
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-[10px] font-black uppercase tracking-widest text-gold">
                  {path.profile_target || 'Usuário'}
                </span>
                <span className="text-white/30 text-xs font-bold uppercase tracking-widest">•</span>
                <span className="text-white/30 text-xs font-bold uppercase tracking-widest">{path.level}</span>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
                {path.name}
              </h1>
              
              <p className="text-white/50 text-lg font-medium max-w-3xl leading-relaxed">
                {path.description}
              </p>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2 text-white/40">
                  <Clock className="w-4 h-4 text-gold/60" />
                  <span className="text-sm font-bold uppercase tracking-widest">{path.duration} total</span>
                </div>
                <div className="flex items-center gap-2 text-white/40">
                  <Signal className="w-4 h-4 text-gold/60" />
                  <span className="text-sm font-bold uppercase tracking-widest">Nível {path.difficulty}</span>
                </div>
              </div>
            </div>

            <div className="w-full md:w-72 p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                  <span className="text-white/40">Seu Progresso</span>
                  <span className="text-gold">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-1.5 bg-white/5" />
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  {stats.completedLessons} de {stats.totalLessons} aulas concluídas
                </div>
              </div>
              
              <Button className="w-full bg-gold text-black font-black uppercase tracking-widest py-6 rounded-xl hover:bg-gold/80 transition-all shadow-[0_8px_24px_rgba(212,175,55,0.2)]">
                Continuar
              </Button>
            </div>
          </div>
        </div>

        {/* Modules List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
              <PlayCircle className="text-gold w-6 h-6" />
              Módulos da Trilha
            </h2>
            
            <div className="space-y-4">
              {modules.map((module: any, mIdx: number) => (
                <div key={module.id} className="rounded-3xl border border-white/5 bg-white/[0.01] overflow-hidden">
                  <div className="p-6 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black text-gold uppercase tracking-widest mb-1">Módulo {mIdx + 1}</div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">{module.name}</h3>
                    </div>
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
                      {module.lessons?.length || 0} aulas
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    {module.lessons?.map((lesson: any) => (
                      <AcademyLessonItem 
                        key={lesson.id} 
                        lesson={lesson} 
                        pathId={pathId}
                        isCompleted={lesson.progress === 'completed'}
                      />
                    ))}
                    {(!module.lessons || module.lessons.length === 0) && (
                      <div className="text-center py-8 text-white/20 text-xs font-bold uppercase tracking-widest">
                        Nenhuma aula disponível neste módulo.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar / Requirements */}
          <aside className="space-y-6">
            <div className="p-8 rounded-3xl border border-white/5 bg-gradient-to-br from-gold/10 to-transparent space-y-6">
              <h3 className="font-black text-white uppercase italic tracking-tighter">O que você vai aprender</h3>
              <ul className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-white/70 leading-relaxed">
                      Explicação detalhada sobre o módulo {i} e suas aplicações práticas no dia a dia.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.02] space-y-6">
              <h3 className="font-black text-white uppercase italic tracking-tighter">Próximos Passos</h3>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest leading-loose">
                Ao concluir esta trilha, você estará apto a gerenciar todos os aspectos da plataforma com proficiência técnica.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AcademyLayout>
  );
}
