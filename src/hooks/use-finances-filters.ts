import { useMemo, useState } from "react";
import { computeBarberPeriodRange, isDateInBarberRange } from "@/lib/finances-helpers";
import type { ReportPeriod } from "@/lib/finances-pdf";

export function useFinancesFilters() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split("T")[0]);
  const [financeTab, setFinanceTab] = useState<string>("transactions");
  const [globalPeriod, setGlobalPeriod] = useState<ReportPeriod>("month");

  const [barberPeriodPreset, setBarberPeriodPreset] = useState<string>("today");
  const [barberCustomStart, setBarberCustomStart] = useState<string>("");
  const [barberCustomEnd, setBarberCustomEnd] = useState<string>("");
  const barberPeriodRange = useMemo(
    () => computeBarberPeriodRange(barberPeriodPreset, barberCustomStart, barberCustomEnd),
    [barberPeriodPreset, barberCustomStart, barberCustomEnd],
  );
  const inBarberRange = (date?: string | null) => isDateInBarberRange(date, barberPeriodRange);

  const [refundStatusFilter, setRefundStatusFilter] = useState<string>("all");
  const [refundDateStartFilter, setRefundDateStartFilter] = useState<string>("");
  const [refundDateEndFilter, setRefundDateEndFilter] = useState<string>("");
  const [refundSearchTerm, setRefundSearchTerm] = useState<string>("");

  return {
    statusFilter, setStatusFilter,
    dateFilter, setDateFilter,
    financeTab, setFinanceTab,
    globalPeriod, setGlobalPeriod,
    barberPeriodPreset, setBarberPeriodPreset,
    barberCustomStart, setBarberCustomStart,
    barberCustomEnd, setBarberCustomEnd,
    barberPeriodRange,
    inBarberRange,
    refundStatusFilter, setRefundStatusFilter,
    refundDateStartFilter, setRefundDateStartFilter,
    refundDateEndFilter, setRefundDateEndFilter,
    refundSearchTerm, setRefundSearchTerm,
  };
}
