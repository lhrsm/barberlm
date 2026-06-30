import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/loyalty")({
  component: LoyaltyLayout,
});

function LoyaltyLayout() {
  return <Outlet />;
}
                            {reward.months_required === 1 ? "mês" : "meses"}
                          </span>
                        </div>
                      </div>
                      <Switch checked={reward.active} onCheckedChange={() => toggleSubscriptionReward(reward)} />
                    </div>

                    <Badge className={`mb-3 ${TYPE_COLOR[reward.reward_type]}`} variant="outline">
                      <Gift className="w-3 h-3 mr-1" /> {TYPE_LABEL[reward.reward_type]}
                    </Badge>
                    <p className="text-sm text-zinc-200 mb-2 leading-snug">{reward.description}</p>
                    {Number(reward.reward_value) > 0 && (
                      <p className="text-xs text-amber-400 font-medium mb-3">
                        {reward.reward_type === "cashback" || reward.reward_type === "discount"
                          ? `${reward.reward_value}%`
                          : `R$ ${Number(reward.reward_value).toFixed(2)}`}
                      </p>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-zinc-800">
                      <Button variant="outline" size="sm" className="flex-1 border-zinc-800 hover:border-amber-500/40" onClick={() => openEditSubscriptionReward(reward)}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" className="border-zinc-800 hover:border-red-500/40 hover:text-red-400" onClick={() => removeSubscriptionReward(reward.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900/40 p-5">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <History className="w-5 h-5 shrink-0 text-amber-400" />
                <h3 className="text-lg font-bold text-white break-words">Recompensas Premium Concedidas</h3>
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 md:ml-auto" variant="outline">
                  {subscriptionHistory.filter((h) => h.status === "granted").length} pendentes
                </Badge>
              </div>
              {subscriptionHistory.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-7">
                  Nenhuma recompensa concedida ainda. Clique em <strong className="text-amber-400">Sincronizar</strong> para processar assinantes.
                </p>
              ) : (
                <div className="space-y-2">
                  {subscriptionHistory.map((historyItem) => (
                    <div key={historyItem.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white truncate">{historyItem.customer?.name || "Cliente"}</span>
                          <Badge
                            variant="outline"
                            className={historyItem.status === "redeemed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]" : "bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]"}
                          >
                            {historyItem.status === "redeemed" ? "Resgatado" : "Pendente"}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 truncate">{historyItem.reward?.months_required}m · {historyItem.reward?.description}</p>
                        <p className="text-[10px] text-zinc-500">Concedido em {new Date(historyItem.granted_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                      {historyItem.status === "granted" && (
                        <Button size="sm" onClick={() => redeemSubscriptionReward(historyItem.id)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Resgatar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>



        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Próximos da recompensa"
            value={closeToReward.length}
            icon={<Users className="h-5 w-5 text-[#ea580c]" />}
          />
          <KpiCard
            label="Concedidas no mês"
            value={grantedMonth.length}
            icon={<Gift className="h-5 w-5 text-emerald-400" />}
          />
          <KpiCard
            label="Utilizadas no mês"
            value={redeemedMonth.length}
            icon={<Trophy className="h-5 w-5 text-amber-400" />}
          />
          <KpiCard
            label="Economia gerada (clientes)"
            value={`R$ ${totalSavings.toFixed(2)}`}
            icon={<TrendingDown className="h-5 w-5 text-blue-400" />}
          />
        </div>

        {/* Clientes próximos da recompensa */}
        <Card className="bg-[#0b0f17] border border-[#1f2937] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase italic tracking-wider">
              Clientes próximos da recompensa
            </CardTitle>
            <CardDescription className="text-slate-400">
              Meta atual: <span className="text-[#ea580c] font-bold">{target} atendimentos</span> — Benefício:{" "}
              <span className="text-[#ea580c] font-bold">{benefitDesc}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : closeToReward.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nenhum cliente acumulando pontos ainda.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {closeToReward.map((c: any) => {
                  const points = c.loyalty_points || 0;
                  const pct = Math.min(100, Math.round((points / target) * 100));
                  const remaining = Math.max(0, target - points);
                  return (
                    <div
                      key={c.id}
                      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f1420] to-[#05070d] border border-[#1f2937] hover:border-[#ea580c]/50 transition-all p-5 flex flex-col gap-4 shadow-[0_4px_20px_rgba(234,88,12,0.06)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                            {remaining === 0 ? "Recompensa liberada" : `Faltam ${remaining}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-[#ea580c]/40 text-[#ea580c] font-bold shrink-0">
                          {pct}%
                        </Badge>
                      </div>

                      <div className="flex items-end justify-center gap-1 py-2">
                        <span className="text-5xl font-black italic text-[#ea580c] leading-none tabular-nums">
                          {points}
                        </span>
                        <span className="text-lg font-bold text-slate-500 leading-none pb-1">
                          /{target}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-[#1f2937] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#ea580c] to-[#f97316] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center">
                          Atendimentos
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de recompensas */}
        <Card className="bg-[#0b0f17] border border-[#1f2937] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase italic tracking-wider">
              Últimas recompensas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rewards.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nenhuma recompensa ainda.</p>
            ) : (
              <div className="space-y-2">
                {rewards.slice(0, 20).map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#05070d] border border-[#1f2937]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{r.benefit_description}</p>
                      <p className="text-[10px] text-slate-500 uppercase">
                        Gerada em {new Date(r.earned_at).toLocaleDateString("pt-BR")}
                        {r.status === "redeemed" && r.redeemed_at && (
                          <> · Usada em {new Date(r.redeemed_at).toLocaleDateString("pt-BR")}</>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        r.status === "available"
                          ? "border-emerald-500/40 text-emerald-400"
                          : r.status === "redeemed"
                          ? "border-amber-500/40 text-amber-400"
                          : "border-slate-500/40 text-slate-400"
                      }
                    >
                      {r.status === "available"
                        ? "Disponível"
                        : r.status === "redeemed"
                        ? "Usada"
                        : r.status === "expired"
                        ? "Expirada"
                        : r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={rewardDialogOpen} onOpenChange={setRewardDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              {editingReward?.id ? "Editar recompensa" : "Nova recompensa Premium"}
            </DialogTitle>
          </DialogHeader>
          {editingReward && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-zinc-300">Meses requeridos</Label>
                <Input
                  type="number"
                  min={1}
                  value={editingReward.months_required ?? 1}
                  onChange={(e) => setEditingReward({ ...editingReward, months_required: parseInt(e.target.value) || 1 })}
                  className="bg-zinc-900 border-zinc-800 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Tipo de recompensa</Label>
                <Select value={editingReward.reward_type || "free_service"} onValueChange={(value) => setEditingReward({ ...editingReward, reward_type: value as RewardType })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-300">Valor {editingReward.reward_type === "cashback" || editingReward.reward_type === "discount" ? "(%)" : "(R$)"}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editingReward.reward_value ?? 0}
                  onChange={(e) => setEditingReward({ ...editingReward, reward_value: parseFloat(e.target.value) || 0 })}
                  className="bg-zinc-900 border-zinc-800 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Descrição</Label>
                <Textarea
                  placeholder="Ex.: Hidratação capilar grátis após 3 meses como assinante"
                  value={editingReward.description || ""}
                  onChange={(e) => setEditingReward({ ...editingReward, description: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-white mt-1 min-h-[80px]"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label className="text-zinc-300">Recompensa ativa</Label>
                <Switch checked={!!editingReward.active} onCheckedChange={(value) => setEditingReward({ ...editingReward, active: value })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRewardDialogOpen(false)} className="border-zinc-800">Cancelar</Button>
            <Button onClick={saveSubscriptionReward} className="bg-gradient-to-br from-amber-500 to-amber-600 text-black font-semibold">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function LoyaltyNavButton({
  to,
  search,
  icon,
  label,
  active = false,
}: {
  to: string;
  search?: Record<string, string>;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  const base =
    "shrink-0 inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 cursor-pointer";
  const cls = active
    ? "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-black border border-[#f59e0b] shadow-[0_4px_16px_rgba(245,158,11,0.35)] hover:shadow-[0_8px_28px_rgba(245,158,11,0.55)]"
    : "bg-[#0b0f17] text-white border border-[#f59e0b]/30 [&_svg]:text-[#f59e0b] hover:border-[#f59e0b]/70 hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]";
  return (
    <Link
      to={to as any}
      search={search as any}
      activeOptions={{ exact: true }}
      className={`${base} ${cls}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <Card className="bg-[#0b0f17] border border-[#1f2937] text-white">
      <CardContent className="p-5 flex items-center justify-between">

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-2xl font-black italic mt-1">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-[#05070d] border border-[#1f2937] flex items-center justify-center">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function PremiumKpi({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "amber" | "sky" | "emerald" | "red" }) {
  const tones = {
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-300",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    red: "border-red-500/30 bg-red-500/5 text-red-300",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}
