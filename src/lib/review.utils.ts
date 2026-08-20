/**
 * Utilitário canônico de resolução de estado do ciclo de avaliação do cliente.
 * Compartilhado entre AppointmentsTab, HomeTab e demais componentes do portal.
 */

export type ReviewDecisionState =
  | 'PENDING_DECISION'
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_SKIPPED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

export interface ResolvedReviewState {
  state: ReviewDecisionState;
  decision: 'pending' | 'submitted' | 'skipped' | null;
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  canReview: boolean;
  canSkip: boolean;
  label: string;
}

export function resolveReviewState(app: any, reviewsStatus?: 'success' | 'error'): ResolvedReviewState {
  if (!app || app.status !== "completed") {
    return {
      state: "NOT_APPLICABLE",
      decision: null,
      canReview: false,
      canSkip: false,
      label: "",
    };
  }

  // 1. Fail-closed: se a query de reviews falhou no portal
  if (app.reviewStatus === "unknown" || reviewsStatus === "error") {
    return {
      state: "UNKNOWN",
      decision: null,
      canReview: false,
      canSkip: false,
      label: "Avaliação Indisponível",
    };
  }

  // 2. Recusa explícita do cliente (prioridade absoluta)
  if (app.review_decision === "skipped") {
    return {
      state: "REVIEW_SKIPPED",
      decision: "skipped",
      canReview: false,
      canSkip: false,
      label: "Sem avaliação",
    };
  }

  // 3. Avaliação enviada (via relação appointment_reviews, flag ou reviewStatus)
  const review = app.appointment_reviews || app.review;
  const hasSubmittedReview = !!(
    (review && (review.submitted_at || review.id)) ||
    app.review_decision === "submitted" ||
    app._review_id ||
    app.reviewStatus === "reviewed"
  );

  if (hasSubmittedReview) {
    const moderation = (review?.testimonial_status || (app._review_id ? "approved" : "pending")) as "pending" | "approved" | "rejected";
    const label =
      moderation === "approved"
        ? "✓ Avaliado"
        : moderation === "rejected"
        ? "Avaliação enviada"
        : "Avaliação enviada • Em moderação";

    return {
      state: "REVIEW_SUBMITTED",
      decision: "submitted",
      moderationStatus: moderation,
      canReview: false,
      canSkip: false,
      label,
    };
  }

  // 4. Concluído pendente de decisão do cliente
  // Legacy safety fallback only:
  // After Hotfix 11 migration, completed appointments should be
  // canonically pending/submitted/skipped in the database.
  return {
    state: "PENDING_DECISION",
    decision: "pending",
    canReview: true,
    canSkip: true,
    label: "Avaliar Agora",
  };
}
