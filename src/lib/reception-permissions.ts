/**
 * Catálogo central de permissões do Portal da Recepção.
 * Fonte única usada pelo frontend (ocultar ações) e espelhada no banco
 * pela função `public.reception_can(user_id, action)` usada nas policies.
 */

export type ReceptionAction =
  | "complete_appointment"
  | "apply_discount"
  | "apply_coupon"
  | "add_credit"
  | "add_cashback"
  | "cancel_payment"
  | "refund"
  | "open_cash"
  | "close_cash"
  | "view_finances_summary"
  | "view_commissions"
  | "change_payment_method"
  | "delete_appointment"
  | "change_professional"
  | "manage_waiting_list"
  | "sell_without_appointment";

export interface ReceptionActionMeta {
  action: ReceptionAction;
  label: string;
  description: string;
  group: "Atendimento" | "Financeiro" | "Caixa" | "Operação";
}

export const RECEPTION_ACTIONS: ReceptionActionMeta[] = [
  { action: "complete_appointment", label: "Concluir atendimento", description: "Marcar atendimentos como concluídos.", group: "Atendimento" },
  { action: "change_professional", label: "Alterar profissional", description: "Trocar o profissional de um atendimento.", group: "Atendimento" },
  { action: "delete_appointment", label: "Excluir agendamento", description: "Remover agendamentos da agenda.", group: "Atendimento" },
  { action: "manage_waiting_list", label: "Gerenciar lista de espera", description: "Criar, editar e encaixar clientes da lista de espera.", group: "Operação" },
  { action: "sell_without_appointment", label: "Vender sem agendamento", description: "Registrar venda avulsa de produtos.", group: "Operação" },
  { action: "apply_discount", label: "Conceder desconto", description: "Aplicar desconto manual no atendimento.", group: "Financeiro" },
  { action: "apply_coupon", label: "Aplicar cupom manualmente", description: "Usar cupons no fechamento.", group: "Financeiro" },
  { action: "add_credit", label: "Adicionar crédito", description: "Lançar crédito na conta do cliente.", group: "Financeiro" },
  { action: "add_cashback", label: "Adicionar cashback", description: "Lançar cashback manual.", group: "Financeiro" },
  { action: "change_payment_method", label: "Alterar forma de pagamento", description: "Trocar a forma de pagamento registrada.", group: "Financeiro" },
  { action: "cancel_payment", label: "Cancelar pagamento", description: "Cancelar um pagamento registrado.", group: "Financeiro" },
  { action: "refund", label: "Realizar estorno", description: "Estornar valores ao cliente.", group: "Financeiro" },
  { action: "view_finances_summary", label: "Ver financeiro resumido", description: "Visualizar o resumo financeiro do dia.", group: "Financeiro" },
  { action: "view_commissions", label: "Ver comissões", description: "Visualizar comissões dos profissionais.", group: "Financeiro" },
  { action: "open_cash", label: "Abrir caixa", description: "Abrir o caixa e informar valor inicial.", group: "Caixa" },
  { action: "close_cash", label: "Fechar caixa", description: "Fechar o caixa e informar valor contado.", group: "Caixa" },
];

/** Permissões liberadas por padrão ao criar um usuário de recepção. */
export const DEFAULT_RECEPTION_PERMISSIONS: Record<string, boolean> = {
  complete_appointment: true,
  manage_waiting_list: true,
  change_professional: false,
  delete_appointment: false,
  sell_without_appointment: true,
  apply_discount: false,
  apply_coupon: false,
  add_credit: false,
  add_cashback: false,
  change_payment_method: false,
  cancel_payment: false,
  refund: false,
  view_finances_summary: false,
  view_commissions: false,
  open_cash: false,
  close_cash: false,
};

/**
 * Função central de verificação. Administradores da barbearia sempre podem.
 * O backend revalida via RLS / RPC — isso aqui é apenas UX.
 */
export function canReceptionPerform(
  action: ReceptionAction,
  ctx: { isOwner?: boolean; permissions?: Record<string, any> | null },
): boolean {
  if (ctx.isOwner) return true;
  return ctx.permissions?.[action] === true;
}
