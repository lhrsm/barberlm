import { CheckCircle2 } from "lucide-react";

interface BookingConfirmationCardProps {
  name: string;
}

export function BookingConfirmationCard({ name }: BookingConfirmationCardProps) {
  const firstName = (name || "").split(" ")?.filter(Boolean)[0]?.toUpperCase();
  
  return (
    <div className="w-full p-4 md:p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
        <CheckCircle2 size={20} />
      </div>
      <div className="flex-1 text-left">
        <h3 className="text-emerald-950 font-bold text-base md:text-lg leading-tight">
          OLÁ, {firstName}! 👋
        </h3>
        <p className="text-zinc-500 text-xs md:text-sm font-medium">
          Que bom ter você de volta!
        </p>
      </div>
    </div>
  );
}
