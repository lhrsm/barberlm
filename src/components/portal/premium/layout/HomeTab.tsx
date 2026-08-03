import * as React from "react";
import { HeroJornada } from "./HeroJornada";
import { AssistenteBarbex } from "./AssistenteBarbex";
import { QuickActions } from "./QuickActions";
import { JourneyBarbex } from "./JourneyBarbex";
import { ProfissionalFavorito } from "./ProfissionalFavorito";
import { EstatisticasPessoais } from "./EstatisticasPessoais";
import { ProdutosRecomendados } from "./ProdutosRecomendados";

type Props = {
  client: any;
  shop: any;
  customerData: any;
  mySubscription: any;
  appointments: any[];
  sales: any[];
  loyaltyRewards: any[];
  barbers: any[];
  products: any[];
  coupons?: any[];
  subscriptionsEnabled: boolean;
  onNewAppointment: () => void;
};

/**
 * "Sua Jornada Barbex" — Premium Portal Experience.
 *
 * Rules-based today, AI-ready tomorrow. Every card only renders when the
 * underlying data justifies it, keeping the surface honest and personal.
 */
export function SuaJornadaBarbex({
  client,
  shop,
  customerData,
  mySubscription,
  appointments,
  sales,
  loyaltyRewards,
  barbers,
  products,
  coupons,
  subscriptionsEnabled,
  onNewAppointment,
}: Props) {
  const hasCashback = Number(customerData?.cashback_balance || 0) > 0;
  const hasCredits = Number(customerData?.credits || 0) > 0;
  const isSubscriber = !!mySubscription;

  return (
    <div className="space-y-6">
      <HeroJornada
        client={client}
        shop={shop}
        customerData={customerData}
        mySubscription={mySubscription}
        appointments={appointments}
        onNewAppointment={onNewAppointment}
      />

      <AssistenteBarbex
        appointments={appointments}
        customerData={customerData}
        mySubscription={mySubscription}
        sales={sales}
      />

      <QuickActions
        hasCashback={hasCashback}
        hasCredits={hasCredits}
        isSubscriber={isSubscriber}
        subscriptionsEnabled={subscriptionsEnabled}
      />

      <JourneyBarbex
        appointments={appointments}
        customerData={customerData}
        mySubscription={mySubscription}
        loyaltyRewards={loyaltyRewards}
        sales={sales}
        coupons={coupons}
      />

      <ProfissionalFavorito appointments={appointments} barbers={barbers} />

      <EstatisticasPessoais
        appointments={appointments}
        sales={sales}
        customerData={customerData}
      />

      <ProdutosRecomendados products={products} sales={sales} />
    </div>
  );
}
