import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const BarbexModal = DialogPrimitive.Root;
export const BarbexModalTrigger = DialogPrimitive.Trigger;
export const BarbexModalClose = DialogPrimitive.Close;

const Overlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
Overlay.displayName = "BarbexModalOverlay";

export const BarbexModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-[95vw] max-w-[700px] -translate-x-1/2 -translate-y-1/2 gap-0 rounded-[20px] bg-[#0B1220] border border-white/[0.08] shadow-2xl",
        "max-h-[90vh] overflow-hidden",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus:outline-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
BarbexModalContent.displayName = "BarbexModalContent";

export const BarbexModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-8 pt-8 pb-4 border-b border-white/5 sticky top-0 bg-[#0B1220] z-10", className)}
    {...props}
  />
);

export const BarbexModalBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-8 py-6 overflow-y-auto", className)} {...props} />
);

export const BarbexModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "px-8 py-5 border-t border-white/5 flex items-center justify-end gap-3 sticky bottom-0 bg-[#0B1220] z-10",
      className
    )}
    {...props}
  />
);

export const BarbexModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-xl font-black uppercase tracking-wider text-white", className)}
    {...props}
  />
));
BarbexModalTitle.displayName = "BarbexModalTitle";

export const BarbexModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-slate-400 mt-1", className)}
    {...props}
  />
));
BarbexModalDescription.displayName = "BarbexModalDescription";
