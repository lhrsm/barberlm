-- HOTFIX 09B: RLS Policy para leitura das próprias avaliações pelo cliente autenticado
-- Permite que o cliente visualize seus próprios reviews em qualquer status (pending, approved, rejected)

DROP POLICY IF EXISTS "Customers can view own reviews" ON public.appointment_reviews;

CREATE POLICY "Customers can view own reviews"
ON public.appointment_reviews
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = appointment_reviews.customer_id
      AND c.tenant_id = appointment_reviews.tenant_id
      AND c.auth_user_id = auth.uid()
  )
);
