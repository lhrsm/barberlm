import { CheckCircle2 } from "lucide-react";

interface BookingConfirmationCardProps {
  name: string;
}

export function BookingConfirmationCard({ name }: BookingConfirmationCardProps) {
  const firstName = name.split(" ")[0].toUpperCase();
  
  return (
    <div className="w-full p-6 bg-emerald-50 border border-emerald-200 rounded-[2rem] flex flex-col items-center text-center gap-3 animate-in fade-in zoom-in duration-500">
      <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
        <CheckCircle2 size={24} />
      </div>
      <div className="space-y-1">
        <h3 className="text-emerald-900 font-black text-xl italic uppercase tracking-tight">
          OLÁ, {firstName}! 👋
        </h3>
        <p className="text-emerald-700/70 text-sm font-bold uppercase tracking-widest">
          Que bom ter você de volta!
        </p>
      </div>
    </div>
  );
}
