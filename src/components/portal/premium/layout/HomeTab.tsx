import * as React from "react";
import { HeroJornada } from "../journey/HeroJornada";
import { AssistenteBarbex } from "../journey/AssistenteBarbex";
import { QuickActions } from "../journey/QuickActions";
import { JourneyBarbex } from "../journey/JourneyEngine";
import { ProfissionalFavorito } from "../journey/ProfissionalFavorito";
import { EstatisticasPessoais } from "../journey/EstatisticasPessoais";
import { ProdutosRecomendados } from "../journey/ProdutosRecomendados";

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
  onNavigate: (tab: string) => void;
};

/**
 * Home dashboard for the premium portal.
 * Refactored from SuaJornadaBarbex to support tabbed navigation.
 */
export function HomeTab({
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
  onNavigate,
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
        onNavigate={onNavigate}
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
