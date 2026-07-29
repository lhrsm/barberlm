import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:border-border/60 group-[.toaster]:bg-surface-raised group-[.toaster]:text-foreground group-[.toaster]:shadow-overlay",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:rounded-lg group-[.toast]:bg-gold group-[.toast]:text-gold-foreground",
          cancelButton: "group-[.toast]:rounded-lg group-[.toast]:bg-surface-sunken group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
