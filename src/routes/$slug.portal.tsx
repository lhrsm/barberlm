import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2,
  Bell,
  Settings,
  LogOut,
  User as UserIcon,
  ArrowLeft,
  ShieldCheck,
  Building2
} from "lucide-react";
import { toast } from "sonner";
import { PortalNavigation } from "@/components/portal/premium/layout/PortalNavigation";
import { HomeTab } from "@/components/portal/premium/layout/HomeTab";
import { AppointmentsTab } from "@/components/portal/premium/tabs/AppointmentsTab";
import { FinancesTab } from "@/components/portal/premium/tabs/FinancesTab";
import { ProfileTab } from "@/components/portal/premium/tabs/ProfileTab";
import { CouponsTab } from "@/components/portal/premium/tabs/CouponsTab";
import { SecurityTab } from "@/components/portal/premium/tabs/SecurityTab";
import { LoyaltyTab } from "@/components/portal/premium/tabs/LoyaltyTab";
import { Button } from "@/components/ui/button";
import { ClientLoginForm } from "@/components/public/auth/ClientLoginForm";
import { normalizePhone } from "@/utils/phone";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { RescheduleWizard, type RescheduleWizardAppointment } from "@/components/reschedule/RescheduleWizard";
import { ReviewModal } from "@/components/portal/ReviewModal";
import { SkipReviewDialog } from "@/components/portal/SkipReviewDialog";
import { Scissors } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/$slug/portal")({
  component: CustomerPortalPage,
});

function CustomerPortalPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, profile, logout, role } = useAuth();
  const { slug } = useParams({ from: "/$slug/portal" });

  type PortalState = 'INITIALIZING' | 'AUTH_RESOLVED' | 'TENANT_RESOLVED' | 'CUSTOMER_RESOLVED' | 'DATA_READY' | 'ERROR' | 'NOT_FOUND' | 'ADMIN_SESSION_ON_CUSTOMER_PORTAL';
  const [portalState, setPortalState] = useState<PortalState>('INITIALIZING');
  const [activeTab, setActiveTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmSwitchOpen, setConfirmSwitchOpen] = useState(false);

  // Canary Visual Temporário
  const CANARY_ID = "v2026-08-19-A";
  const [data, setData] = useState<{
    customer: any;
    shop: any;
    appointments: any[];
    creditTransactions: any[];
    cashbackTransactions: any[];
    levels: any[];
    achievements: any[];
    unlockedAchievements: any[];
    reviews: any[];
    coupons: any[];
    mySubscription: any;
    subscriptionPlans: any[];
    subPlanServices: any[];
    subUsageLogs: any[];
    reviewsStatus: 'success' | 'error';
    couponsStatus: 'success' | 'error';
  } | null>(null);
  const [lastCheck, setLastCheck] = useState(Date.now());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Appointment Actions state
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | undefined>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<RescheduleWizardAppointment | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reviewAppointment, setReviewAppointment] = useState<any | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [skipAppointment, setSkipAppointment] = useState<any | null>(null);

  // ProfileTab state
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPortalData = useCallback(async (isBackground = false) => {
    const trace = (event: string, meta?: any) => {
      console.log(`[PORTAL_RESOLUTION_TRACE] ${event}`, {
        timestamp: new Date().toISOString(),
        portalState,
        slug,
        userId: user?.id,
        ...meta
      });
    };

    trace("Starting loadPortalData", { isBackground });

    const isSilent = isBackground || (data && portalState === 'DATA_READY');
    if (isSilent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
      setPortalState('INITIALIZING');
    }

    if (!user) {
      trace("No user, stopping");
      setPortalState('UNAUTHENTICATED' as any);
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    setPortalState('AUTH_RESOLVED');

    // 1. Resolve Tenant canonically from profiles.slug (URL slug has absolute priority)
    let effectiveTenantId: string | null = null;
    if (slug) {
      trace("Resolving tenant from slug via profiles", { slug });
      const { data: shopProfile, error: shopErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (shopProfile) {
        effectiveTenantId = shopProfile.id;
        trace("Tenant resolved from slug", { effectiveTenantId });
      } else if (shopErr) {
        trace("Tenant resolution error", { shopErr });
      }
    }

    if (!effectiveTenantId && profile?.tenant_id) {
      effectiveTenantId = profile.tenant_id;
    }

    if (!effectiveTenantId) {
      trace("Tenant NOT resolved");
      setPortalState('ERROR');
      setErrorMessage("Estabelecimento não encontrado.");
      setLoading(false);
      return;
    }

    setPortalState('TENANT_RESOLVED');

    try {
      // 2. Resolve Customer
      trace("Fetching customer identity via auth_user_id");

      // Strict lookup: by authenticated user's auth_user_id in this tenant
      let { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*, loyalty_levels(*)")
        .eq("auth_user_id" as any, user.id)
        .eq("tenant_id", effectiveTenantId)
        .maybeSingle();

      if (customerError) {
        console.error("[PORTAL_RESOLUTION_TRACE] Customer auth_user_id query error:", customerError);
      }

      // Fallback: Se ainda não vinculado, tentar claim seguro via RPC por e-mail autenticado
      if (!customerData) {
        trace("Customer not linked by auth_user_id, attempting claim_customer_profile RPC");
        const { data: claimRes, error: claimErr } = await (supabase.rpc as any)("claim_customer_profile", {
          p_tenant_id: effectiveTenantId
        });

        const isClaimSuccess =
          claimRes &&
          ((claimRes as any).status === 'SUCCESS' ||
            (claimRes as any).success === true ||
            (claimRes as any).status === 'ALREADY_CLAIMED');
        const claimedCustomerId = (claimRes as any).customer_id;

        if (claimErr) {
          console.error("[PORTAL_RESOLUTION_TRACE] Claim RPC error:", claimErr);
        } else if (isClaimSuccess && claimedCustomerId) {
          trace("Claim RPC succeeded", { customerId: claimedCustomerId });
          const { data: claimedCustomer, error: fetchClaimedErr } = await supabase
            .from("customers")
            .select("*, loyalty_levels(*)")
            .eq("id", claimedCustomerId)
            .eq("tenant_id", effectiveTenantId)
            .maybeSingle();

          if (fetchClaimedErr) {
            console.error("[PORTAL_RESOLUTION_TRACE] Error fetching claimed customer:", fetchClaimedErr);
          } else if (claimedCustomer) {
            customerData = claimedCustomer;
          }
        } else {
          trace("Claim RPC returned non-success status", { claimRes });
          // Fallback seguro: tentar buscar novamente caso a RPC já tenha atualizado auth_user_id
          const { data: retryCustomer } = await supabase
            .from("customers")
            .select("*, loyalty_levels(*)")
            .eq("auth_user_id" as any, user.id)
            .eq("tenant_id", effectiveTenantId)
            .maybeSingle();
          if (retryCustomer) {
            customerData = retryCustomer;
          }
        }
      }

      if (!customerData) {
        // Verificar se a sessão autenticada pertence a um papel administrativo ou profissional do Barbex
        const adminRoles = ['admin', 'tenant_admin', 'super_admin', 'manager', 'receptionist', 'financial', 'cashier', 'professional', 'barber', 'reception', 'finance'];
        let isAdminOrStaff = adminRoles.includes(role || '') || adminRoles.includes(profile?.role || '');

        if (!isAdminOrStaff && user?.id) {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (userProfile && adminRoles.includes(userProfile.role)) {
            isAdminOrStaff = true;
          }
        }

        if (isAdminOrStaff) {
          trace("Authenticated session is admin/staff on customer portal", { role, profileRole: profile?.role });
          setPortalState('ADMIN_SESSION_ON_CUSTOMER_PORTAL');
          setLoading(false);
          setIsRefreshing(false);
          return;
        }

        trace("Customer NOT found");
        setPortalState('NOT_FOUND');
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      setPortalState('CUSTOMER_RESOLVED');
      setCustomerName(customerData.name || "");

      // 3. Parallel Data Fetch com isolamento de falhas secundárias
      const safeQuery = async <T,>(queryPromise: PromiseLike<T>): Promise<T | { data: null; error: any }> => {
        try {
          return await queryPromise;
        } catch (error) {
          return { data: null, error };
        }
      };

      const [
        shopRes,
        apptsRes,
        creditsRes,
        cashbackRes,
        levelsRes,
        achRes,
        unlockedRes,
        reviewsRes,
        couponsRes,
        subRes,
        plansRes,
        planSvcsRes,
        usageLogsRes
      ] = await Promise.all([
        supabase.from("profiles").select("id, business_name, slug, whatsapp_number, primary_color, secondary_color, logo_url, barbershop_logo_url, address, font_family, subscriptions_enabled").eq("id", effectiveTenantId).maybeSingle(),
        supabase.from("appointments").select("*, services(*), barbers:barbers!appointments_barber_id_fkey(*), appointment_reviews(*)").eq("customer_id", customerData.id).eq("tenant_id", effectiveTenantId).order("start_time", { ascending: false }),
        safeQuery(supabase.from("credit_transactions").select("*").eq("customer_id", customerData.id).order("created_at", { ascending: false })),
        safeQuery(supabase.from("cashback_transactions").select("*").eq("customer_id", customerData.id).order("created_at", { ascending: false })),
        safeQuery(supabase.from("loyalty_levels").select("*").order("sort_order", { ascending: true })),
        safeQuery(supabase.from("loyalty_achievements").select("*").order("xp_reward", { ascending: true })),
        safeQuery(supabase.from("customer_achievements").select("*").eq("customer_id", customerData.id)),
        safeQuery(supabase.from("appointment_reviews").select("*").eq("customer_id", customerData.id).eq("tenant_id", effectiveTenantId)),
        safeQuery(supabase.from("coupons").select("*").eq("tenant_id", effectiveTenantId).order("created_at", { ascending: false })),
        safeQuery(supabase.from("customer_subscriptions").select("*, plan:subscription_plans(*)").eq("customer_id", customerData.id).eq("tenant_id", effectiveTenantId).in("status", ["active", "paused", "trialing"]).maybeSingle()),
        safeQuery(supabase.from("subscription_plans").select("*, plan_services:subscription_plan_services(*, service:services(*))").eq("tenant_id", effectiveTenantId).eq("active", true).order("monthly_price", { ascending: true })),
        safeQuery(supabase.from("subscription_plan_services").select("*, service:services(*)").eq("tenant_id", effectiveTenantId)),
        safeQuery(supabase.from("subscription_usage_logs").select("*, service:services(name)").eq("customer_id", customerData.id).eq("tenant_id", effectiveTenantId).order("used_at", { ascending: false }))
      ]);

      if (apptsRes && 'error' in apptsRes && apptsRes.error) console.error("[PORTAL_RESOLUTION_TRACE] Appointments fetch error:", apptsRes.error);

      // Verificação estrita de integridade de reviews
      const reviewsOk = Boolean(reviewsRes && !(reviewsRes as any).error && Array.isArray((reviewsRes as any).data));
      const couponsOk = Boolean(couponsRes && !(couponsRes as any).error && Array.isArray((couponsRes as any).data));

      // Mapeamento em lote de avaliações com resolução determinística de duplicatas históricas (mais recente prevalece)
      const reviewsByApptId = new Map<string, any>();
      if (reviewsOk) {
        const sortedReviews = [...(((reviewsRes as any)?.data) || [])].sort((a: any, b: any) => {
          const tA = new Date(a.created_at || a.submitted_at || 0).getTime();
          const tB = new Date(b.created_at || b.submitted_at || 0).getTime();
          return tB - tA;
        });
        for (const r of sortedReviews) {
          if (r.appointment_id && !reviewsByApptId.has(r.appointment_id)) {
            reviewsByApptId.set(r.appointment_id, r);
          }
        }
      }

      // Enriquecimento dos agendamentos com estado fail-closed e decisão canônica
      const enrichedAppointments = (((apptsRes as any)?.data || [])).map((a: any) => {
        const matchingReview: any = reviewsOk ? reviewsByApptId.get(a.id) : null;
        const hasRealReview = Boolean(
          matchingReview && (
            matchingReview.submitted_at ||
            (matchingReview.rating != null && Number(matchingReview.rating) > 0) ||
            matchingReview.testimonial_status === "approved" ||
            matchingReview.testimonial_status === "rejected" ||
            matchingReview.testimonial_status === "submitted"
          )
        );

        const reviewStatus: 'reviewed' | 'not_reviewed' | 'unknown' =
          !reviewsOk
            ? 'unknown'
            : hasRealReview
            ? 'reviewed'
            : 'not_reviewed';

        // Preserva estritamente a decisão gravada no banco ou sincronizada
        const review_decision = a.review_decision || (hasRealReview ? 'submitted' : null);

        return {
          ...a,
          review_decision: a.review_decision || review_decision,
          _review_id: hasRealReview ? matchingReview?.id : null,
          review: matchingReview || null,
          reviewStatus
        };
      });

      trace("Data fetch complete", {
        apptsCount: enrichedAppointments.length,
        reviewsOk,
        couponsOk,
        hasSubscription: Boolean((subRes as any)?.data),
        reviewedCount: reviewsOk ? (reviewsRes as any).data?.length : 'ERROR',
        couponsCount: couponsOk ? (couponsRes as any).data?.length : 'ERROR',
      });

      const rawUsageLogs: any[] = (usageLogsRes as any)?.data || [];
      const planServicesList: any[] = (planSvcsRes as any)?.data || [];
      const allLoggedAppointmentIds = new Set(
        rawUsageLogs.map((l: any) => l.appointment_id).filter(Boolean)
      );

      // Legado: sintetizar consumo APENAS para appointments cobertos por assinatura que NÃO possuem registro em subscription_usage_logs
      const legacyAppointments = enrichedAppointments.filter((a: any) => {
        if (allLoggedAppointmentIds.has(a.id)) return false; // Proíbe estritamente dupla contagem mesmo para logs cancelados
        const isCancelled = a.status === "cancelled" || a.status === "canceled" || a.status === "no_show";
        if (isCancelled) return false; // Agendamento cancelado nunca é reintroduzido como consumo
        const isSubCovered = a.payment_method === "subscription" || (a.subscription_id && a.subscription_id === (subRes as any)?.data?.id) || Number(a.subscription_covered_amount || 0) > 0;
        return isSubCovered && (a.status === "completed" || a.status === "confirmed" || a.status === "scheduled");
      });

      const synthLogs = legacyAppointments.map((a: any) => {
        const sName = a.services?.name || a.service?.name || "Serviço do Clube";
        const matchedPlanService = planServicesList.find((ps: any) => ps.service_id === a.service_id || ps.service?.id === a.service_id);
        const isCategoryBoth = a.service?.category === "both" || matchedPlanService?.service?.category === "both";
        const resolvedConsumeQty = Number(matchedPlanService?.consume_quantity) || (isCategoryBoth ? 2 : 1);

        return {
          id: `synth-${a.id}`,
          appointment_id: a.id,
          customer_id: a.customer_id,
          service_id: a.service_id,
          service_name: sName,
          services: { name: sName },
          consume_quantity: resolvedConsumeQty,
          status: a.status === "completed" ? "consumed" : "reserved",
          used_at: a.start_time || a.created_at,
          created_at: a.created_at,
        };
      });

      const resolvedUsageLogs = [...rawUsageLogs, ...synthLogs];

      setData({
        customer: customerData,
        shop: shopRes?.data,
        appointments: enrichedAppointments,
        creditTransactions: (creditsRes as any)?.data || [],
        cashbackTransactions: (cashbackRes as any)?.data || [],
        levels: (levelsRes as any)?.data || [],
        achievements: (achRes as any)?.data || [],
        unlockedAchievements: (unlockedRes as any)?.data || [],
        reviews: reviewsOk ? (reviewsRes as any)?.data || [] : [],
        coupons: couponsOk ? (couponsRes as any)?.data || [] : [],
        mySubscription: (subRes as any)?.data || null,
        subscriptionPlans: (plansRes as any)?.data || [],
        subPlanServices: (planSvcsRes as any)?.data || [],
        subUsageLogs: resolvedUsageLogs,
        reviewsStatus: reviewsOk ? 'success' : 'error',
        couponsStatus: couponsOk ? 'success' : 'error'
      });

      setPortalState('DATA_READY');
    } catch (err: any) {
      trace("Fatal error", { err });
      setPortalState('ERROR');
      setErrorMessage(err.message || "Erro desconhecido ao carregar dados");
      toast.error("Erro ao sincronizar portal: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }

  }, [user, profile?.tenant_id, profile?.phone, profile?.email, slug]);


  useEffect(() => {
    if (portalState !== 'DATA_READY' || !data?.customer?.id || !data?.shop?.id) return;

    const channel = supabase
      .channel(`portal_updates_${data.customer.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `customer_id=eq.${data.customer.id}`
      }, () => {
        console.log("[PORTAL_RESOLUTION_TRACE] Realtime update triggered");
        loadPortalData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [portalState, data?.customer?.id, data?.shop?.id, loadPortalData]);



  useEffect(() => {
    // Safety check for loading state
    if (loading && user && data?.customer) {
      setLoading(false);
    }
  }, [loading, user, data?.customer]);


  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      const timeSinceLastCheck = now - lastCheck;

      console.log("[PORTAL_RESOLUTION_TRACE] Visibility Change", {
        visibilityState: document.visibilityState,
        portalState,
        hasUser: !!user,
        hasProfile: !!profile,
        hasData: !!data,
        timeSinceLastCheck,
        timestamp: new Date().toISOString()
      });

      if (
        document.visibilityState === 'visible' &&
        user &&
        data?.customer &&
        portalState === 'DATA_READY' &&
        timeSinceLastCheck > 5000
      ) {
        setLastCheck(now);
        loadPortalData(true); // Background refresh on visibility change
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, profile, data, portalState, lastCheck, loadPortalData]);

  useEffect(() => {
    console.log("[PORTAL_BOOT_TRACE] Effect trigger", {
      authLoading,
      hasUser: !!user,
      hasProfile: !!profile,
      slug
    });

    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    loadPortalData();
  }, [user, authLoading, slug, loadPortalData]);

  const handleLogout = async () => {
    try {
      await logout();
      // Use local redirect for consistency
      window.location.href = `/${slug}`;
    } catch (err) {
      console.error("Logout error:", err);
      navigate({ to: `/${slug}` as any, replace: true });
    }
  };

  if (authLoading && (!data || !data.customer)) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center" data-debug-portal={CANARY_ID}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-gold animate-spin" />
          <p className="text-gold/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
            Autenticando...
          </p>
          <span className="text-[10px] text-white/10 uppercase tracking-widest font-mono mt-8">DEBUG PORTAL A ({CANARY_ID})</span>
        </div>
      </div>
    );
  }

  if (user && loading && (!data || !data.customer)) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center" data-debug-portal={CANARY_ID}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-gold animate-spin" />
          <p className="text-gold/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
            Sincronizando sua Experiência...
          </p>
          <span className="text-[10px] text-white/10 uppercase tracking-widest font-mono mt-8">DEBUG PORTAL A ({CANARY_ID})</span>
          {/* Fallback para evitar loading infinito */}
          <button
            onClick={() => setLoading(false)}
            className="mt-4 text-[9px] text-white/20 hover:text-white/40 uppercase tracking-widest font-bold"
          >
            Forçar Carregamento
          </button>
        </div>
      </div>
    );
  }

  // Dual-purpose Route: Login or Dashboard
  if (!user) {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-[480px] space-y-8">
          <div className="flex justify-center mb-8">
            <a href={`/${slug}`}>
              <Button variant="ghost" className="text-gold hover:text-gold/80 hover:bg-gold/10 gap-2 font-black uppercase tracking-widest text-[10px]">
                <ArrowLeft size={16} /> Voltar para a barbearia
              </Button>
            </a>
          </div>
          <div className="bg-[#0B1220] border border-[#F59E0B]/20 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <ClientLoginForm barbershopSlug={slug} />
          </div>
        </div>
      </div>
    );
  }

  if (portalState === 'ADMIN_SESSION_ON_CUSTOMER_PORTAL') {
    let panelUrl = '/dashboard';
    const effectiveRole = role || profile?.role;
    if (effectiveRole === 'barber' || effectiveRole === 'professional') {
      panelUrl = `/${slug}/profissional`;
    } else if (effectiveRole === 'receptionist' || effectiveRole === 'reception') {
      panelUrl = '/dashboard/centro-de-comando';
    } else if (effectiveRole === 'financial' || effectiveRole === 'finance') {
      panelUrl = '/finances';
    } else if (effectiveRole === 'super_admin') {
      panelUrl = '/admin/dashboard';
    }

    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 animate-in fade-in duration-700 bg-[#0B1220] border border-[#F59E0B]/20 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="h-20 w-20 rounded-3xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-2 shadow-[0_0_25px_rgba(212,175,55,0.15)]">
            <Building2 className="h-10 w-10 text-gold" />
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">
              Você está conectado ao painel da barbearia
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Esta sessão pertence a uma conta administrativa ou profissional. Para acessar o Portal do Cliente, entre com uma conta de cliente.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => setConfirmSwitchOpen(true)}
              variant="default"
              className="bg-gold hover:bg-gold/90 text-black font-black uppercase tracking-widest py-6 rounded-2xl shadow-lg active:scale-95 transition-all text-xs"
            >
              Entrar como cliente
            </Button>

            <a href={panelUrl} className="w-full">
              <Button
                variant="ghost"
                className="w-full text-gold/80 hover:text-gold hover:bg-gold/10 font-bold uppercase tracking-widest text-[10px] py-4 rounded-xl"
              >
                Voltar ao painel
              </Button>
            </a>
          </div>
        </div>

        <AlertDialog open={confirmSwitchOpen} onOpenChange={setConfirmSwitchOpen}>
          <AlertDialogContent className="bg-[#0B1220] border border-white/10 text-white rounded-3xl p-6">
            <AlertDialogHeader className="space-y-3">
              <AlertDialogTitle className="text-lg font-black uppercase italic text-gold tracking-tight">
                Trocar para conta de cliente?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400 text-xs leading-relaxed">
                Para entrar como cliente, será necessário sair da conta administrativa atual. Isso também encerrará essa sessão nas outras guias abertas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
              <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setConfirmSwitchOpen(false);
                  setLoading(true);
                  try {
                    await supabase.auth.signOut();
                    setData(null);
                    setPortalState('UNAUTHENTICATED' as any);
                  } catch (err) {
                    console.error("[PORTAL_SIGNOUT_ERROR]", err);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="bg-gold hover:bg-gold/90 text-black font-black uppercase rounded-xl text-xs"
              >
                Sair e entrar como cliente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (portalState === 'ERROR' || portalState === 'NOT_FOUND' || (portalState === 'DATA_READY' && !data?.customer)) {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 animate-in fade-in duration-700">
          <div className="h-20 w-20 rounded-3xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-6">
            <UserIcon className="h-10 w-10 text-gold/40" />
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">
              {portalState === 'ERROR' ? "Erro de Conexão" : "Perfil não encontrado"}
            </h1>
            <p className="text-zinc-500 text-sm leading-relaxed">
              {portalState === 'ERROR'
                ? (errorMessage || "Ocorreu um erro ao carregar seus dados. Por favor, tente novamente.")
                : "Não conseguimos localizar seu cadastro como cliente neste estabelecimento. Isso pode ocorrer se você for um administrador sem perfil de cliente associado."}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button
              onClick={() => loadPortalData()}
              variant="default"
              className="bg-gold hover:bg-gold/90 text-black font-black uppercase tracking-widest py-6 rounded-2xl"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Tentar Novamente"}
            </Button>

            <Button
              onClick={handleLogout}
              variant="ghost"
              className="text-gold/60 hover:text-gold hover:bg-gold/10 font-bold uppercase tracking-widest text-[10px]"
            >
              Sair da conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.customer) return null;

  const currentLevel = data?.customer?.loyalty_levels;
  const levels = data.levels || [];
  const currentIndex = levels.findIndex((l: any) => l.id === currentLevel?.id);
  const nextLevel = currentIndex !== -1 && currentIndex < levels.length - 1 ? levels[currentIndex + 1] : undefined;

  const achievements = data.achievements.map((ach: any) => ({
    ...ach,
    unlocked: data.unlockedAchievements?.some((ua: any) => ua.achievement_id === ach.id),
    unlocked_at: data.unlockedAchievements?.find((ua: any) => ua.achievement_id === ach.id)?.unlocked_at
  }));

  const renderTabContent = () => {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab
            client={data.customer}
            shop={data.shop}
            slug={slug}
            customerData={data.customer}
            mySubscription={data.mySubscription}
            subscriptionPlans={data.subscriptionPlans}
            subPlanServices={data.subPlanServices}
            subUsageLogs={data.subUsageLogs}
            appointments={data.appointments}
            sales={[]}
            loyaltyRewards={[]}
            barbers={[]}
            products={[]}
            subscriptionsEnabled={Boolean(data.shop?.subscriptions_enabled ?? true)}
            onNewAppointment={() => window.dispatchEvent(new CustomEvent("OPEN_BOOKING_MODAL"))}
            onNavigate={setActiveTab}
            onViewDetails={(id) => {
              setSelectedAppointmentId(id);
              setDetailsOpen(true);
            }}
            onReview={(app) => {
              setReviewAppointment(app);
              setReviewOpen(true);
            }}
            onSkipReview={(app) => setSkipAppointment(app)}
            onRefresh={() => loadPortalData(true)}
          />
        );
      case "appointments":
        return (
          <AppointmentsTab
            appointments={data.appointments}
            onViewDetails={(id) => {
              setSelectedAppointmentId(id);
              setDetailsOpen(true);
            }}
            onReview={(app) => {
              setReviewAppointment(app);
              setReviewOpen(true);
            }}
            onSkipReview={(app) => setSkipAppointment(app)}
          />
        );
      case "finances":
        return (
          <FinancesTab
            creditTransactions={data.creditTransactions}
            cashbackTransactions={data.cashbackTransactions}
          />
        );
      case "loyalty":
        return (
          <LoyaltyTab
            customerData={data.customer}
            appointments={data.appointments}
            creditTransactions={data.creditTransactions}
            cashbackTransactions={data.cashbackTransactions}
            reviews={data.reviews}
            reviewsStatus={data.reviewsStatus}
            shopName={data.shop?.business_name}
          />
        );
      case "coupons":
        return (
          <CouponsTab
            coupons={data.coupons}
            couponsStatus={data.couponsStatus}
            shopSlug={slug}
            shopName={data.shop?.business_name}
          />
        );
      case "profile":
        return (
          <ProfileTab
            customerData={data.customer}
            setCustomerData={(newData) => {
              if (data) {
                setData({ ...data, customer: newData });
              }
            }}
            customerName={customerName}
            setCustomerName={setCustomerName}
            submitting={submitting}
            setSubmitting={setSubmitting}
            fetchClientData={() => loadPortalData()}
            slug={slug}
            setClient={() => {}} // Not used but kept for type compatibility
          />
        );
      case "security":
        return (
          <SecurityTab
            user={user}
            customerData={data.customer}
            shopName={data.shop?.business_name}
            onLogout={handleLogout}
          />
        );
      default:
        return <div>Em breve...</div>;
    }
  };

  console.log("[PORTAL_RESOLUTION_TRACE] Render", {
    portalState,
    hasUser: !!user,
    hasProfile: !!profile,
    hasData: !!data,
    loading,
    authLoading,
    activeTab,
    visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown'
  });

  return (
    <div className="min-h-screen bg-[#05070d] text-white" data-debug-portal={CANARY_ID}>
      {/* Marcador de Diagnóstico Discreto */}
      <div className="fixed bottom-2 left-2 z-[9999] pointer-events-none opacity-20 hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-mono text-zinc-500">A</span>
      </div>

      {/* Premium Header */}
      <header className="sticky top-0 z-50 w-full bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <PortalHeaderLogo shop={data.shop} slug={slug} />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg font-black text-white leading-tight truncate">
                {data.shop?.business_name || (slug ? slug.toUpperCase() : "Barbex")}
              </h2>
              <p className="text-[10px] sm:text-[11px] font-bold text-zinc-400 truncate">
                Olá, <span className="text-gold font-extrabold">{data.customer.name?.split(' ')[0] || 'Cliente'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-gold rounded-xl transition-all">
              <Bell className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-gold rounded-xl transition-all"
              onClick={() => setActiveTab('profile')}
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-red-400 rounded-xl transition-all"
              onClick={async () => {
                await logout();
                window.location.href = `/${slug}`;
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>

            <a href={`/${slug}`} className="hidden md:block">
              <Button
                variant="outline"
                size="sm"
                className="border-gold/30 text-gold hover:bg-gold/10 rounded-xl text-[10px] font-black uppercase tracking-widest h-9"
              >
                Site
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <PortalNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSubscriber={false}
        subscriptionsEnabled={false}
        storeEnabled={false}
        couponsEnabled={true}
        slug={slug}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {renderTabContent()}
      </main>

      <AppointmentDetailsModal
        appointmentId={selectedAppointmentId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        mode="customer"
        onSuccess={() => loadPortalData(true)}
        onReschedule={(app) => {
          setRescheduleAppointment(app);
          setRescheduleOpen(true);
        }}
      />

      <RescheduleWizard
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        appointment={rescheduleAppointment}
        actor="customer"
        actorId={user?.id}
        actorName={data?.customer?.name}
        source="customer_portal"
        allowProfessionalChange={true}
        onSuccess={() => loadPortalData(true)}
      />

      <ReviewModal
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) setReviewAppointment(null);
        }}
        appointment={reviewAppointment}
        tenantId={data?.shop?.id || data?.customer?.tenant_id || ""}
        onSubmitted={() => {
          const submittedId = reviewAppointment?.id;
          if (submittedId) {
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                appointments: prev.appointments.map((a: any) =>
                  a.id === submittedId
                    ? { ...a, review_decision: "submitted", _review_id: "pending", reviewStatus: "reviewed" }
                    : a
                ),
              };
            });
          }
          setReviewOpen(false);
          setReviewAppointment(null);
          loadPortalData(true);
        }}
      />

      {skipAppointment && (
        <SkipReviewDialog
          open={!!skipAppointment}
          onOpenChange={(open) => {
            if (!open) setSkipAppointment(null);
          }}
          appointment={skipAppointment}
          onSkipped={(app) => {
            const skippedId = app?.id || skipAppointment?.id;
            if (skippedId) {
              setData((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  appointments: prev.appointments.map((a: any) =>
                    a.id === skippedId
                      ? { ...a, review_decision: "skipped" }
                      : a
                  ),
                };
              });
            }
            setSkipAppointment(null);
            loadPortalData(true);
          }}
        />
      )}
    </div>
  );
}

function PortalHeaderLogo({ shop, slug }: { shop: any; slug: string }) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = shop?.barbershop_logo_url || shop?.logo_url;
  const name = shop?.business_name || (slug ? slug.toUpperCase() : "");
  const initials = name
    ? name
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/30 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
      {logoUrl && !imgError ? (
        <img
          src={logoUrl}
          alt={name || "Logo"}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : initials ? (
        <span className="text-gold font-black text-xs sm:text-sm tracking-wider">
          {initials}
        </span>
      ) : (
        <Scissors className="h-5 w-5 text-gold" />
      )}
    </div>
  );
}
