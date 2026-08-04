import { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GraduationCap, ChevronRight, BookOpen } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";

interface Props {
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

export function AcademyLayout({ children, breadcrumb }: Props) {
  const location = useLocation();

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#050810] text-white">
        {/* Sub-header with navigation/breadcrumb */}
        <div className="border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              <Link 
                to="/academy" 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                  location.pathname === "/academy" 
                  ? "bg-gold text-black" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                Academia
              </Link>
              
              {breadcrumb?.map((item, i) => (
                <div key={i} className="flex items-center gap-2 shrink-0">
                  <ChevronRight className="w-3.5 h-3.5 text-white/20" />
                  {item.href ? (
                    <Link 
                      to={item.href as any}
                      className="text-sm font-bold text-white/60 hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-sm font-bold text-white truncate max-w-[150px] md:max-w-none">
                      {item.label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-6 text-[11px] font-bold uppercase tracking-widest text-white/40">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-gold" />
                <span>Aprendizado Progressivo</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {children}
        </div>
      </div>
    </AppLayout>
  );
}
