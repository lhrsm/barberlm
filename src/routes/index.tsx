import { createFileRoute, useNavigate, Outlet, useLocation, Link } from "@tanstack/react-router";
import { TrialExpiredBlock } from "@/components/subscription/TrialExpiredBlock";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Scissors, Calendar, CalendarDays, MapPin, Phone, MessageSquare, Clock, CheckCircle2, ChevronRight, ChevronLeft, ChevronDown, ShoppingBag, Package, Gift, Trash2, Star, QrCode, User as UserIcon, RefreshCcw, CircleDollarSign, ArrowLeft, ArrowRight, ArrowUp, Plus, Minus, Tag, TicketPercent, X, Crown, Menu, Lock as LockIcon, ExternalLink, Ban, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { createNotification } from "@/utils/notifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PixReceiptStep } from "@/components/calendar/appointment/PixReceiptStep";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, addMinutes, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { triggerWhatsAppMessage } from "@/utils/whatsapp";
import { triggerAutomation } from "@/utils/automation";
import { emitAutomationEvent } from "@/utils/emit-event";
import { normalizePhone } from "@/utils/phone";
import { usePublicModules } from "@/hooks/use-public-modules";
import { getSubscriptionUsage } from "@/hooks/use-subscription-usage";
import { ExhaustedUsesModal } from "@/components/portal/ExhaustedUsesModal";
import { ChangePlanModal } from "@/components/portal/ChangePlanModal";
import { SubscribePlanModal } from "@/components/portal/SubscribePlanModal";
import { fetchAvailability, hasConflict, OVERLAP_MESSAGE } from "@/lib/availability";
import { WhyChooseUs } from "@/components/public/WhyChooseUs";
import { PortalFaq } from "@/components/public/PortalFaq";
import { AboutShop } from "@/components/public/AboutShop";
import { StoreHighlights } from "@/components/public/StoreHighlights";
import { SubscriptionValueProps } from "@/components/public/SubscriptionValueProps";
import { LoyaltySteps } from "@/components/public/LoyaltySteps";
import { BeforeAfterShowcase } from "@/components/public/BeforeAfterShowcase";
import { PortalEvents } from "@/components/public/PortalEvents";
import { PortalPartners } from "@/components/public/PortalPartners";
import { PortalStickyCta } from "@/components/public/PortalStickyCta";
import { PortalStructuredData } from "@/components/public/PortalStructuredData";
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

// Minimal component for debugging
function LandingPageComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white p-4">
      <div className="text-center space-y-4">
        <div className="h-16 w-16 bg-gold/20 border border-gold/30 rounded-2xl mx-auto grid place-items-center">
          <Scissors className="text-gold h-8 w-8" />
        </div>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">Barbex <span className="text-gold">Enterprise</span></h1>
        <p className="text-zinc-400 max-w-md mx-auto">Plataforma premium de gestão para barbearias. O sistema está sendo preparado para produção.</p>
        <div className="flex gap-4 justify-center">
          <Button variant="gold" className="rounded-xl font-black" asChild>
            <Link to="/auth">Entrar no Sistema</Link>
          </Button>
          <Button variant="outline" className="rounded-xl border-zinc-800" asChild>
            <Link to="/tutorials">Saiba Mais</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: LandingPageComponent,
  head: () => ({
    meta: [
      { title: "Barbex Enterprise — Plataforma Premium para Barbearias" },
      { name: "description", content: "A solução definitiva em gestão, marketing e fidelização para barbearias de alto padrão." }
    ]
  })
});