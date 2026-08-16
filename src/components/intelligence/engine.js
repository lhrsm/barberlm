const n = (v) => Number(v || 0);
export const brl = (v) => `R$ ${n(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const DAY = 86400000;
export const daysBetween = (a, b = new Date()) => Math.floor((+new Date(b) - +new Date(a)) / DAY);
const apptValue = (a) => n(a?.final_amount ?? a?.total_price);
const isCompleted = (a) => a?.status === "completed";
const isCancelled = (a) => a?.status === "cancelled" || a?.status === "no_show";
const isActiveAppt = (a) => !isCancelled(a);
const priorityOf = (score) => score >= 80 ? "muito-alta" : score >= 60 ? "alta" : score >= 40 ? "media" : "baixa";
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export function buildIntelligence(data) {
    const now = new Date();
    const { customers, appointments, services, barbers, products, productSales, coupons, credits, subscriptions, reviews, } = data;
    const barberName = (id) => barbers.find((b) => b.id === id)?.name || null;
    const serviceName = (id) => services.find((s) => s.id === id)?.name || null;
    // ——— Consolidação por cliente ———
    const byCustomer = {};
    appointments.filter(isCompleted).forEach((a) => {
        if (!a.customer_id)
            return;
        (byCustomer[a.customer_id] ||= []).push(a);
    });
    const customersById = {};
    customers.forEach((c) => {
        const rows = (byCustomer[c.id] || []).sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time));
        const total = rows.reduce((s, a) => s + apptValue(a), 0) || n(c.total_spent);
        const last = rows[0]?.start_time || c.last_visit || null;
        const countBy = (key, resolver) => {
            const map = {};
            rows.forEach((a) => {
                const label = resolver(a[key]);
                if (label)
                    map[label] = (map[label] || 0) + 1;
            });
            return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        };
        customersById[c.id] = {
            id: c.id,
            name: c.name || "Cliente",
            phone: c.phone || null,
            lastVisit: last,
            daysSince: last ? daysBetween(last) : null,
            visits: rows.length,
            totalSpent: total,
            avgTicket: rows.length ? total / rows.length : 0,
            favoriteBarber: countBy("barber_id", barberName) || barberName(c.barber_id),
            favoriteService: countBy("service_id", serviceName),
            cashback: n(c.cashback_balance),
            credits: n(c.credit_balance ?? c.credits),
            birthDate: c.birth_date || null,
        };
    });
    const allRows = Object.values(customersById);
    // ——— Inativos ———
    const BUCKETS = [
        { label: "15+ dias", min: 15, max: 30 },
        { label: "30+ dias", min: 30, max: 45 },
        { label: "45+ dias", min: 45, max: 60 },
        { label: "60+ dias", min: 60, max: 90 },
        { label: "90+ dias", min: 90, max: null },
    ];
    const inactiveBuckets = BUCKETS.map((b) => ({
        ...b,
        rows: allRows
            .filter((r) => r.daysSince !== null && r.daysSince >= b.min && (b.max === null || r.daysSince < b.max))
            .sort((a, b2) => b2.totalSpent - a.totalSpent),
    }));
    // ——— Aniversariantes ———
    const inBirthdayRange = (r, days) => {
        if (!r.birthDate)
            return false;
        const d = new Date(r.birthDate);
        if (Number.isNaN(+d))
            return false;
        for (let i = 0; i <= days; i++) {
            const ref = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
            if (ref.getMonth() === d.getUTCMonth() && ref.getDate() === d.getUTCDate())
                return true;
        }
        return false;
    };
    const birthdays = {
        today: allRows.filter((r) => inBirthdayRange(r, 0)),
        week: allRows.filter((r) => inBirthdayRange(r, 7)),
        month: allRows.filter((r) => {
            if (!r.birthDate)
                return false;
            const d = new Date(r.birthDate);
            return !Number.isNaN(+d) && d.getUTCMonth() === now.getMonth();
        }),
    };
    // ——— VIPs ———
    const vips = [...allRows]
        .filter((r) => r.visits > 0)
        .sort((a, b) => b.totalSpent - a.totalSpent || b.visits - a.visits)
        .slice(0, 10);
    // ——— Em risco ———
    const atRisk = [];
    allRows.forEach((r) => {
        if (r.visits < 2 || r.daysSince === null)
            return;
        const rows = (byCustomer[r.id] || []).sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
        const gaps = [];
        for (let i = 1; i < rows.length; i++)
            gaps.push(daysBetween(rows[i - 1].start_time, rows[i].start_time));
        const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 30;
        const recent = rows.slice(-2).reduce((s, a) => s + apptValue(a), 0) / Math.min(2, rows.length);
        if (r.daysSince > avgGap * 1.6 && r.daysSince >= 20) {
            atRisk.push({ row: r, reason: `Costuma voltar a cada ${Math.round(avgGap)} dias — está há ${r.daysSince}.` });
        }
        else if (r.avgTicket > 0 && recent < r.avgTicket * 0.7) {
            atRisk.push({ row: r, reason: "Ticket recente abaixo da média histórica." });
        }
    });
    const cancelledRecent = appointments.filter((a) => isCancelled(a) && daysBetween(a.cancelled_at || a.start_time) <= 30);
    cancelledRecent.forEach((a) => {
        const row = customersById[a.customer_id];
        if (row && !atRisk.some((x) => x.row.id === row.id)) {
            atRisk.push({ row, reason: "Cancelou um atendimento nos últimos 30 dias." });
        }
    });
    // ——— Próximos de recompensa (fidelidade / cashback / crédito) ———
    const nearReward = [];
    allRows.forEach((r) => {
        if (r.cashback > 0)
            nearReward.push({ row: r, reason: `${brl(r.cashback)} de cashback disponível.` });
        else if (r.credits > 0)
            nearReward.push({ row: r, reason: `${brl(r.credits)} em créditos para usar.` });
        else if (r.visits > 0 && r.visits % 5 === 4)
            nearReward.push({ row: r, reason: "A 1 atendimento de completar 5 visitas." });
    });
    // ——— Horários ociosos ———
    const activeBarbers = barbers.filter((b) => b.active !== false);
    const SLOT = 30;
    const buildIdle = (date) => {
        const dayAppts = appointments.filter((a) => a.start_time && isActiveAppt(a) && sameDay(new Date(a.start_time), date));
        const avgTicket = allRows.filter((r) => r.avgTicket > 0).reduce((s, r) => s + r.avgTicket, 0) /
            Math.max(1, allRows.filter((r) => r.avgTicket > 0).length) || 50;
        return activeBarbers
            .map((b) => {
            const busy = dayAppts.filter((a) => a.barber_id === b.id).length;
            const capacity = Math.round((10 * 60) / SLOT);
            const free = Math.max(0, capacity - busy);
            return {
                barberId: b.id,
                barberName: b.name,
                date: date.toISOString(),
                label: date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }),
                freeSlots: free,
                potential: free * avgTicket,
            };
        })
            .filter((s) => s.freeSlots > 0);
    };
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const weekIdle = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        weekIdle.push(...buildIdle(d));
    }
    const idle = { today: buildIdle(now), tomorrow: buildIdle(tomorrow), week: weekIdle };
    // ——— Produtos ———
    const soldMap = {};
    productSales
        .filter((s) => s.status !== "cancelled" && s.status !== "refunded")
        .forEach((s) => {
        const items = Array.isArray(s.items) ? s.items : [];
        if (items.length === 0)
            return;
        items.forEach((it) => {
            const name = it?.name || it?.product_name || "Produto";
            soldMap[name] ||= { name, count: 0, total: 0 };
            soldMap[name].count += n(it?.quantity || 1);
            soldMap[name].total += n(it?.total ?? it?.price) * n(it?.quantity || 1);
        });
    });
    const soldNames = new Set(Object.keys(soldMap).map((s) => s.toLowerCase()));
    const productsBlock = {
        noSales: products.filter((p) => p.active !== false && !soldNames.has(String(p.name).toLowerCase())),
        topSellers: Object.values(soldMap).sort((a, b) => b.count - a.count).slice(0, 6),
        lowStock: products.filter((p) => p.active !== false && n(p.stock_quantity) <= 3),
    };
    // ——— Serviços ———
    const completed = appointments.filter(isCompleted);
    const inWindow = (a, from, to) => {
        const d = daysBetween(a.start_time);
        return d >= to && d < from;
    };
    const svcAgg = {};
    completed.forEach((a) => {
        const name = serviceName(a.service_id) || "Serviço";
        svcAgg[name] ||= { name, current: 0, previous: 0, total: 0, count: 0 };
        svcAgg[name].count += 1;
        svcAgg[name].total += apptValue(a);
        if (inWindow(a, 30, 0))
            svcAgg[name].current += 1;
        else if (inWindow(a, 60, 30))
            svcAgg[name].previous += 1;
    });
    const svcRows = Object.values(svcAgg).map((s) => ({
        ...s,
        pct: s.previous > 0 ? Number((((s.current - s.previous) / s.previous) * 100).toFixed(1)) : s.current > 0 ? 100 : 0,
    }));
    const servicesBlock = {
        rising: svcRows.filter((s) => s.pct > 5 && s.current > 0).sort((a, b) => b.pct - a.pct).slice(0, 5),
        falling: svcRows.filter((s) => s.pct < -5).sort((a, b) => a.pct - b.pct).slice(0, 5),
        lowVolume: svcRows.filter((s) => s.count <= 2).map((s) => ({ name: s.name, count: s.count })).slice(0, 6),
        topRevenue: svcRows.sort((a, b) => b.total - a.total).slice(0, 5).map((s) => ({ name: s.name, total: s.total, count: s.count })),
    };
    // ——— Cupons ———
    const couponsBlock = {
        active: coupons.filter((c) => c.active && (!c.expires_at || +new Date(c.expires_at) > +now)),
        expiring: coupons.filter((c) => c.active && c.expires_at && daysBetween(now, c.expires_at) >= 0 && daysBetween(now, c.expires_at) <= 15),
        mostUsed: [...coupons].sort((a, b) => n(b.used_count) - n(a.used_count)).filter((c) => n(c.used_count) > 0).slice(0, 5),
        neverUsed: coupons.filter((c) => n(c.used_count) === 0),
    };
    // ——— Cashback / Créditos ———
    const cashbackBlock = {
        withBalance: allRows.filter((r) => r.cashback > 0).sort((a, b) => b.cashback - a.cashback),
        neverUsed: allRows.filter((r) => r.cashback > 0 && (r.daysSince === null || r.daysSince > 30)),
    };
    const creditsBlock = {
        withBalance: allRows.filter((r) => r.credits > 0).sort((a, b) => b.credits - a.credits),
        expiringSoon: credits.filter((c) => n(c.available_amount) > 0 &&
            c.expires_at &&
            daysBetween(now, c.expires_at) >= 0 &&
            daysBetween(now, c.expires_at) <= 30),
    };
    // ——— Assinaturas ———
    const activeSubs = subscriptions.filter((s) => s.status === "active");
    const subsBlock = {
        renewing: activeSubs.filter((s) => s.current_period_end && daysBetween(now, s.current_period_end) >= 0 && daysBetween(now, s.current_period_end) <= 10),
        lowUsage: activeSubs.filter((s) => n(s.uses_this_period) > 0 && n(s.uses_this_period) <= 1),
        unused: activeSubs.filter((s) => n(s.uses_this_period) === 0),
    };
    // ——— Avaliações ———
    const submitted = reviews.filter((r) => r.submitted_at);
    const reviewsBlock = {
        negative: submitted.filter((r) => Math.min(...[r.barber_rating, r.barbershop_rating, r.service_rating].map(n).filter((x) => x > 0).concat([5])) <= 3),
        pendingReply: submitted.filter((r) => r.testimonial_text && !r.reply),
        notReviewed: completed.filter((a) => daysBetween(a.start_time) <= 30 && !reviews.some((r) => r.appointment_id === a.id)).length,
    };
    // ——— Financeiro ———
    const sumWindow = (from, to) => completed.filter((a) => inWindow(a, from, to)).reduce((s, a) => s + apptValue(a), 0);
    const revenueThisWeek = sumWindow(7, 0);
    const revenueLastWeek = sumWindow(14, 7);
    const monthRows = completed.filter((a) => {
        const d = new Date(a.start_time);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const prevMonthRows = completed.filter((a) => {
        const d = new Date(a.start_time);
        const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
    });
    const revenueThisMonth = monthRows.reduce((s, a) => s + apptValue(a), 0);
    const ticketThisMonth = monthRows.length ? revenueThisMonth / monthRows.length : 0;
    const prevRevenue = prevMonthRows.reduce((s, a) => s + apptValue(a), 0);
    const ticketLastMonth = prevMonthRows.length ? prevRevenue / prevMonthRows.length : 0;
    const last30 = appointments.filter((a) => daysBetween(a.start_time) <= 30 && daysBetween(a.start_time) >= 0);
    const cancelRate30 = last30.length
        ? Math.round((last30.filter(isCancelled).length / last30.length) * 100)
        : 0;
    const capacityWeek = Math.max(1, activeBarbers.length * 7 * Math.round((10 * 60) / SLOT));
    const busyWeek = appointments.filter((a) => isActiveAppt(a) && daysBetween(a.start_time) <= 7 && daysBetween(a.start_time) >= 0).length;
    const finance = {
        revenueThisWeek,
        revenueLastWeek,
        weekTrendPct: revenueLastWeek > 0 ? Number((((revenueThisWeek - revenueLastWeek) / revenueLastWeek) * 100).toFixed(1)) : null,
        revenueThisMonth,
        ticketThisMonth,
        ticketLastMonth,
        ticketTrendPct: ticketLastMonth > 0 ? Number((((ticketThisMonth - ticketLastMonth) / ticketLastMonth) * 100).toFixed(1)) : null,
        cancelRate30,
        occupancy7: Math.min(100, Math.round((busyWeek / capacityWeek) * 100)),
    };
    // ——— Insights ———
    const insights = [];
    const inactive40 = allRows.filter((r) => (r.daysSince ?? 0) >= 40).length;
    if (inactive40 > 0)
        insights.push({ id: "inactive", tone: "warning", text: `Existem ${inactive40} clientes sem retornar há mais de 40 dias.` });
    if (finance.ticketTrendPct !== null && Math.abs(finance.ticketTrendPct) >= 1)
        insights.push({
            id: "ticket",
            tone: finance.ticketTrendPct > 0 ? "positive" : "warning",
            text: `Seu ticket médio ${finance.ticketTrendPct > 0 ? "aumentou" : "caiu"} ${Math.abs(finance.ticketTrendPct)}% em relação ao mês passado.`,
        });
    if (finance.weekTrendPct !== null)
        insights.push({
            id: "week",
            tone: finance.weekTrendPct >= 0 ? "positive" : "warning",
            text: `Seu faturamento está ${Math.abs(finance.weekTrendPct)}% ${finance.weekTrendPct >= 0 ? "acima" : "abaixo"} da semana passada.`,
        });
    const tomorrowFree = idle.tomorrow.reduce((s, i) => s + i.freeSlots, 0);
    if (tomorrowFree > 0)
        insights.push({ id: "idle", tone: "neutral", text: `Você possui ${tomorrowFree} horários vagos amanhã.` });
    if (servicesBlock.rising[0])
        insights.push({ id: "svc-up", tone: "positive", text: `${servicesBlock.rising[0].name} cresceu ${servicesBlock.rising[0].pct}% nos últimos 30 dias.` });
    if (servicesBlock.falling[0])
        insights.push({ id: "svc-down", tone: "warning", text: `${servicesBlock.falling[0].name} caiu ${Math.abs(servicesBlock.falling[0].pct)}% nos últimos 30 dias.` });
    if (productsBlock.topSellers[0])
        insights.push({ id: "prod", tone: "gold", text: `${productsBlock.topSellers[0].name} é o produto mais vendido do período.` });
    if (finance.cancelRate30 >= 15)
        insights.push({ id: "cancel", tone: "warning", text: `Sua taxa de cancelamento em 30 dias é de ${finance.cancelRate30}%.` });
    const busiestBarber = activeBarbers
        .map((b) => ({ name: b.name, count: appointments.filter((a) => a.barber_id === b.id && isActiveAppt(a) && daysBetween(a.start_time) <= 7).length }))
        .sort((a, b) => b.count - a.count)[0];
    if (busiestBarber && busiestBarber.count > 0)
        insights.push({ id: "barber", tone: "gold", text: `${busiestBarber.name} é o profissional com mais atendimentos na semana (${busiestBarber.count}).` });
    if (cashbackBlock.withBalance.length > 0)
        insights.push({
            id: "cb",
            tone: "neutral",
            text: `${cashbackBlock.withBalance.length} clientes possuem cashback acumulado somando ${brl(cashbackBlock.withBalance.reduce((s, r) => s + r.cashback, 0))}.`,
        });
    // ——— Radar Comercial ———
    const avgTicketGlobal = ticketThisMonth || 50;
    const radar = [];
    const push = (item) => radar.push({ ...item, priority: priorityOf(item.score) });
    const inactive45 = allRows.filter((r) => (r.daysSince ?? 0) >= 45);
    if (inactive45.length)
        push({
            id: "radar-inactive",
            title: "Reativar clientes inativos",
            detail: `${inactive45.length} clientes há mais de 45 dias sem retornar.`,
            potential: inactive45.length * avgTicketGlobal * 0.3,
            score: Math.min(100, 55 + inactive45.length * 2),
            effort: "baixa",
            action: { label: "Criar campanha", to: "/campaigns" },
        });
    if (tomorrowFree)
        push({
            id: "radar-idle",
            title: "Preencher horários vagos",
            detail: `Agenda com ${tomorrowFree} horários vagos amanhã.`,
            potential: tomorrowFree * avgTicketGlobal * 0.25,
            score: Math.min(95, 45 + tomorrowFree * 3),
            effort: "baixa",
            action: { label: "Abrir agenda", to: "/calendar" },
        });
    if (cashbackBlock.withBalance.length)
        push({
            id: "radar-cashback",
            title: "Ativar cashback parado",
            detail: `${cashbackBlock.withBalance.length} clientes com cashback disponível.`,
            potential: cashbackBlock.withBalance.reduce((s, r) => s + r.cashback, 0) * 2,
            score: Math.min(90, 35 + cashbackBlock.withBalance.length * 2),
            effort: "baixa",
            action: { label: "Abrir fidelidade", to: "/loyalty" },
        });
    if (creditsBlock.withBalance.length)
        push({
            id: "radar-credits",
            title: "Incentivar uso de créditos",
            detail: `${creditsBlock.withBalance.length} clientes com saldo em créditos.`,
            potential: creditsBlock.withBalance.reduce((s, r) => s + r.credits, 0) * 1.5,
            score: Math.min(85, 30 + creditsBlock.withBalance.length * 2),
            effort: "baixa",
            action: { label: "Abrir financeiro", to: "/finances" },
        });
    if (birthdays.week.length)
        push({
            id: "radar-birthday",
            title: "Aproveitar aniversariantes",
            detail: `${birthdays.week.length} aniversariantes nos próximos 7 dias.`,
            potential: birthdays.week.length * avgTicketGlobal * 0.5,
            score: Math.min(88, 40 + birthdays.week.length * 6),
            effort: "baixa",
            action: { label: "Ver automações", to: "/automations" },
        });
    if (productsBlock.noSales.length)
        push({
            id: "radar-products",
            title: "Girar produtos parados",
            detail: `${productsBlock.noSales.length} produtos sem nenhuma venda no período.`,
            potential: productsBlock.noSales.reduce((s, p) => s + n(p.price), 0) * 0.4,
            score: Math.min(75, 25 + productsBlock.noSales.length * 4),
            effort: "media",
            action: { label: "Abrir produtos", to: "/products" },
        });
    if (couponsBlock.neverUsed.length)
        push({
            id: "radar-coupons",
            title: "Divulgar cupons sem uso",
            detail: `${couponsBlock.neverUsed.length} cupons criados e nunca utilizados.`,
            potential: couponsBlock.neverUsed.length * avgTicketGlobal,
            score: Math.min(70, 25 + couponsBlock.neverUsed.length * 5),
            effort: "baixa",
            action: { label: "Abrir campanhas", to: "/campaigns" },
        });
    if (subsBlock.unused.length)
        push({
            id: "radar-subs",
            title: "Assinantes sem usar benefícios",
            detail: `${subsBlock.unused.length} assinaturas ativas sem uso no período.`,
            potential: subsBlock.unused.length * avgTicketGlobal,
            score: Math.min(92, 50 + subsBlock.unused.length * 5),
            effort: "media",
            action: { label: "Abrir assinaturas", to: "/subscriptions" },
        });
    if (reviewsBlock.negative.length)
        push({
            id: "radar-reviews",
            title: "Recuperar avaliações negativas",
            detail: `${reviewsBlock.negative.length} avaliações com nota 3 ou menor.`,
            potential: reviewsBlock.negative.length * avgTicketGlobal,
            score: Math.min(96, 60 + reviewsBlock.negative.length * 6),
            effort: "media",
            action: { label: "Abrir avaliações", to: "/reviews" },
        });
    if (atRisk.length)
        push({
            id: "radar-risk",
            title: "Clientes em risco de churn",
            detail: `${atRisk.length} clientes com queda de frequência ou ticket.`,
            potential: atRisk.reduce((s, r) => s + r.row.avgTicket, 0),
            score: Math.min(94, 50 + atRisk.length * 3),
            effort: "media",
            action: { label: "Criar campanha", to: "/campaigns" },
        });
    radar.sort((a, b) => b.score - a.score);
    return {
        customersById,
        inactiveBuckets,
        birthdays,
        vips,
        atRisk: atRisk.slice(0, 20),
        nearReward: nearReward.slice(0, 20),
        idle,
        products: productsBlock,
        services: servicesBlock,
        coupons: couponsBlock,
        cashback: cashbackBlock,
        credits: creditsBlock,
        subscriptions: subsBlock,
        reviews: reviewsBlock,
        finance,
        insights,
        radar,
    };
}
