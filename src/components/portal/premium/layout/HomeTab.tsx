import * as React from "react";
import { HeroJornada } from "../journey/HeroJornada";
import { QuickActions } from "../journey/QuickActions";
import { MemberDashboard } from "../MemberDashboard";
import { NextAppointmentCard } from "../NextAppointmentCard";
import { AppointmentsTab } from "../tabs/AppointmentsTab";

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
 * Home dashboard for the portal.
 * Restored to follow functional priority while preserving Gold Premium aesthetic.
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 1. Hero / Greeting / Profile */}
      <HeroJornada
        client={client}
        shop={shop}
        customerData={customerData}
        mySubscription={mySubscription}
        appointments={appointments}
        onNewAppointment={onNewAppointment}
      />

      {/* 2. Next Appointment Highlight */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Sua Próxima Visita</h3>
        </div>
        <NextAppointmentCard 
          appointments={appointments}
          shop={shop}
          onNewAppointment={onNewAppointment}
        />
      </div>

      {/* 3. Quick Actions */}
      <QuickActions
        hasCashback={hasCashback}
        hasCredits={hasCredits}
        isSubscriber={isSubscriber}
        subscriptionsEnabled={subscriptionsEnabled}
        onNavigate={onNavigate}
      />

      {/* 4. Functional Cards (Credits, Cashback, etc) */}
      <MemberDashboard 
        appointments={appointments}
        sales={sales}
        customerData={customerData}
        loyaltyRewards={loyaltyRewards}
        onNavigate={onNavigate}
      />

      {/* 5. Recent History Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Histórico Recente</h3>
          <button 
            onClick={() => onNavigate('appointments')}
            className="text-xs font-black uppercase tracking-widest text-gold hover:text-gold/80 transition-colors"
          >
            Ver Todos
          </button>
        </div>
        <div className="opacity-90">
          <AppointmentsTab 
            appointments={appointments.slice(0, 3)} 
            onViewDetails={() => onNavigate('appointments')}
            onReview={() => onNavigate('appointments')}
          />
        </div>
      </div>
    </div>
  );
}

