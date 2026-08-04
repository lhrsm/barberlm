import { GraduationCap, Clock, Signal, BookOpen, ChevronRight, PlayCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Progress } from "@/components/ui/progress";

interface PathCardProps {
  path: any;
  progress?: number;
}

export function AcademyPathCard({ path, progress = 0 }: PathCardProps) {
  const Icon = GraduationCap; // Default, could map from path.icon

  return (
    <Link 
      to="/academy/$pathId" 
      params={{ pathId: path.id }}
      className="group relative block bg-[#0A1020] border border-white/5 rounded-[32px] overflow-hidden transition-all hover:border-gold/30 hover:shadow-[0_20px_40px_rgba(212,175,55,0.1)] active:scale-[0.98]"
    >
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold group-hover:bg-gold group-hover:text-black transition-all duration-500 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
            <Icon className="w-7 h-7" />
          </div>
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/50">
            {path.level || 'Básico'}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-black text-white group-hover:text-gold transition-colors tracking-tight">
            {path.name}
          </h3>
          <p className="text-white/40 text-sm leading-relaxed line-clamp-2 font-medium">
            {path.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-white/50">
            <Clock className="w-4 h-4 text-gold/60" />
            <span className="text-xs font-bold">{path.duration || '--'}</span>
          </div>
          <div className="flex items-center gap-2 text-white/50">
            <Signal className="w-4 h-4 text-gold/60" />
            <span className="text-xs font-bold">{path.difficulty || 'Normal'}</span>
          </div>
        </div>

        {progress > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-white/40">Progresso</span>
              <span className="text-gold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1 bg-white/5" indicatorClassName="bg-gold" />
          </div>
        )}

        <div className="pt-4 border-t border-white/5 flex items-center justify-between group-hover:translate-x-1 transition-transform">
          <span className="text-xs font-black uppercase tracking-widest text-gold opacity-0 group-hover:opacity-100 transition-opacity">
            Começar Agora
          </span>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-gold" />
        </div>
      </div>
    </Link>
  );
}

export function AcademyLessonItem({ lesson, pathId, isCompleted }: { lesson: any; pathId: string; isCompleted: boolean }) {
  return (
    <Link 
      to="/academy/$pathId/lessons/$lessonId"
      params={{ pathId, lessonId: lesson.id }}
      className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-gold/20 transition-all group"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
        isCompleted 
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
        : "bg-white/5 border-white/10 text-white/40 group-hover:border-gold/40 group-hover:text-gold"
      }`}>
        {isCompleted ? <BookOpen className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
      </div>
      
      <div className="min-w-0 flex-1">
        <h4 className={`text-sm font-bold truncate ${isCompleted ? "text-white/60" : "text-white"}`}>
          {lesson.title}
        </h4>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] font-bold text-white/30 uppercase">{lesson.duration || '5 min'}</span>
          {lesson.difficulty && (
            <>
              <div className="w-1 h-1 rounded-full bg-white/10" />
              <span className="text-[10px] font-bold text-white/30 uppercase">{lesson.difficulty}</span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-gold transition-colors" />
    </Link>
  );
}
