import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { BarbexLogo } from "@/components/ui/barbex-logo";

interface LandingImageProps {
  src: string;
  alt: string;
  className?: string;
  overlayClassName?: string;
  aspectRatio?: "video" | "square" | "portrait" | "auto" | "full";
  priority?: boolean;
}

export function LandingImage({
  src,
  alt,
  className,
  overlayClassName,
  aspectRatio = "video",
  priority = false
}: LandingImageProps) {
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const aspectClasses = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    auto: "aspect-auto",
    full: "h-full w-full"
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className={cn(
        "relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-zinc-900",
        aspectClasses[aspectRatio],
        className
      )}
    >
      {isLoading && !isError && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse flex items-center justify-center">
          <BarbexLogo size="sm" className="opacity-20" />
        </div>
      )}

      {isError ? (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-tr from-zinc-900 to-black">
            <div className="text-gold/20 mb-2">
              <BarbexLogo size="lg" />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">Conteúdo Premium</div>
          </div>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsError(true);
            setIsLoading(false);
          }}
          className={cn(
            "h-full w-full object-cover transition-transform duration-700 hover:scale-105",
            isLoading ? "opacity-0" : "opacity-100"
          )}
        />
      )}
      
      {!isError && (
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent",
          overlayClassName
        )} />
      )}
    </motion.div>
  );
}

interface CTASectionProps {
  title: string;
  description?: string;
  backgroundImage?: string;
  className?: string;
  children?: React.ReactNode;
  align?: "left" | "center";
  variant?: "primary" | "secondary";
}

export function CTASection({
  title,
  description,
  backgroundImage,
  className,
  children,
  align = "center",
  variant = "primary"
}: CTASectionProps) {
  return (
    <section className={cn(
      "relative py-24 px-6 overflow-hidden min-h-[400px] flex items-center",
      variant === "primary" ? "bg-black" : "bg-[#05070d]",
      className
    )}>
      {backgroundImage && (
        <>
          <div className="absolute inset-0 z-0">
            <img 
              src={backgroundImage} 
              alt="" 
              className="w-full h-full object-cover opacity-85 mix-blend-normal"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.15),transparent_70%)]" />
          </div>
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="absolute inset-0 z-[1] bg-black/60 backdrop-blur-[1px]"
          />
        </>
      )}
      
      <div className={cn(
        "relative z-10 w-full max-w-7xl mx-auto",
        align === "center" ? "text-center" : "text-left"
      )}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto space-y-6"
        >
          <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-[0.9]">
            {title}
          </h2>
          {description && (
            <p className="text-slate-400 text-lg md:text-xl font-medium leading-tight">
              {description}
            </p>
          )}
          <div className={cn(
            "flex flex-wrap gap-4 pt-4",
            align === "center" ? "justify-center" : "justify-start"
          )}>
            {children}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
