import * as React from "react";
import { PremiumHeroCard } from "@/components/portal/premium/PremiumHeroCard";

type Props = {
  client: any;
  shop: any;
  customerData: any;
  mySubscription: any;
  appointments: any[];
  onNewAppointment: () => void;
};

/**
 * Functional Hero for the Portal.
 * Focuses on identity and shop relationship.
 */
export function HeroJornada(props: Props) {
  return (
    <div className="space-y-4">
      <PremiumHeroCard
        client={props.client}
        shop={props.shop}
        customerData={props.customerData}
        mySubscription={props.mySubscription}
        appointments={props.appointments}
      />
    </div>
  );
}

