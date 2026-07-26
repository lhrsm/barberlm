import { ProfessionalSelector } from "./ProfessionalSelector";
import { ServiceSelector } from "./ServiceSelector";

interface Props {
  barbers: any[];
  services: any[];
  selectedBarber: string;
  selectedService: string;
  onBarberChange: (id: string) => void;
  onServiceChange: (id: string) => void;
  errors: Record<string, string | null>;
  serviceWarning?: string | null;
}

export function ProfessionalServiceStep({
  barbers,
  services,
  selectedBarber,
  selectedService,
  onBarberChange,
  onServiceChange,
  errors,
  serviceWarning,
}: Props) {
  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-5 duration-300">
      <ProfessionalSelector
        barbers={barbers}
        value={selectedBarber}
        onChange={onBarberChange}
        error={errors.barber}
      />
      <ServiceSelector
        services={services}
        value={selectedService}
        onChange={onServiceChange}
        disabled={!selectedBarber}
        error={errors.service}
        warning={serviceWarning}
      />
    </div>
  );
}
