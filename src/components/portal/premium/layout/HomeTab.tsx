import * as React from "react";
import { HeroJornada } from "../journey/HeroJornada";
import { QuickActions } from "../journey/QuickActions";
import { MemberDashboard } from "../MemberDashboard";
import { NextAppointmentCard } from "../NextAppointmentCard";
import { AppointmentsTab } from "../tabs/AppointmentsTab";
import { SubscriberDashboard } from "../SubscriberDashboard";
import { NonSubscriberDashboard } from "../NonSubscriberDashboard";

type Props = {
  client: any;
  shop: any;
  slug?: string;
  customerData: any;
  mySubscription: any;
  subscriptionPlans?: any[];
  subPlanServices?: any[];
  subUsageLogs?: any[];
  appointments: any[];
  sales?: any[];
  loyaltyRewards?: any[];
  barbers?: any[];
  products?: any[];
  coupons?: any[];
  subscriptionsEnabled?: boolean;
  onNewAppointment: () => void;
  onNavigate: (tab: string) => void;
  onViewDetails?: (id: string) => void;
  onReview?: (app: any) => void;
  onSkipReview?: (app: any) => void;
  onRefresh?: () => void;
};

/**
 * Home dashboard for the portal.
 * Distinct, rich experience for Subscribers vs Non-subscribers.
 */
export function HomeTab({
  client,
  shop,
  slug = "",
  customerData,
  mySubscription,
  subscriptionPlans = [],
  subPlanServices = [],
  subUsageLogs = [],
  appointments,
  sales = [],
  loyaltyRewards = [],
  barbers = [],
  products = [],
  coupons = [],
  subscriptionsEnabled = true,
  onNewAppointment,
  onNavigate,
  onViewDetails,
  onReview,
  onSkipReview,
  onRefresh,
}: Props) {
  const hasCashback = Number(customerData?.cashback_balance || 0) > 0;
  const hasCredits = Number(customerData?.credits || 0) > 0;
  const isSubscriber = !!mySubscription && mySubscription.status === "active";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 1. Hero / Profile greeting */}
      <HeroJornada
        client={client}
        shop={shop}
        customerData={customerData}
        mySubscription={mySubscription}
        appointments={appointments}
        onNewAppointment={onNewAppointment}
      />

      {/* 2. Próximo Agendamento se houver */}
      <div className="space-y-4">
        <NextAppointmentCard
          appointments={appointments}
          shop={shop}
          onNewAppointment={onNewAppointment}
        />
      </div>

      {/* 3. EXPERIÊNCIA DIFERENCIADA: ASSINANTE vs NÃO ASSINANTE */}
      {isSubscriber ? (
        <SubscriberDashboard
          client={client}
          shop={shop}
          customerData={customerData}
          mySubscription={mySubscription}
          subscriptionPlans={subscriptionPlans}
          subPlanServices={subPlanServices}
          subUsageLogs={subUsageLogs}
          appointments={appointments}
          onNewAppointment={onNewAppointment}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
        />
      ) : (
        <NonSubscriberDashboard
          client={client}
          shop={shop}
          slug={slug}
          customerData={customerData}
          subscriptionPlans={subscriptionPlans}
          appointments={appointments}
          onNewAppointment={onNewAppointment}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
        />
      )}

      {/* 4. Histórico Recente de Agendamentos */}
      <div className="space-y-4 pt-4 border-t border-white/10 text-left">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Histórico Recente</h3>
          <button
            type="button"
            onClick={() => onNavigate("appointments")}
            className="text-xs font-black uppercase tracking-widest text-gold hover:text-gold/80 transition-colors"
          >
            Ver Todos
          </button>
        </div>
        <div className="opacity-90">
          <AppointmentsTab
            appointments={appointments.slice(0, 3)}
            onViewDetails={onViewDetails || (() => onNavigate("appointments"))}
            onReview={onReview || (() => onNavigate("appointments"))}
            onSkipReview={onSkipReview}
          />
        </div>
      </div>
    </div>
  );
}
