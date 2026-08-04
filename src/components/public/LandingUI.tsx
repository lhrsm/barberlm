import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LandingImageProps {
  src: string;
  alt: string;
  className?: string;
  overlayClassName?: string;
  aspectRatio?: "video" | "square" | "portrait" | "auto";
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
  const aspectClasses = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    auto: "aspect-auto"
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
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
      />
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent",
        overlayClassName
      )} />
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
              className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/60 to-black" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05),transparent_70%)]" />
          </div>
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="absolute inset-0 z-[1] bg-black/40 backdrop-blur-[2px]"
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
