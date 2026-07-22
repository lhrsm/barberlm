DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saas_admin_voucher_redemptions_voucher_id_fkey'
  ) THEN
    ALTER TABLE public.saas_admin_voucher_redemptions
      ADD CONSTRAINT saas_admin_voucher_redemptions_voucher_id_fkey
      FOREIGN KEY (voucher_id)
      REFERENCES public.saas_admin_vouchers(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saas_admin_voucher_audit_logs_voucher_id_fkey'
  ) THEN
    ALTER TABLE public.saas_admin_voucher_audit_logs
      ADD CONSTRAINT saas_admin_voucher_audit_logs_voucher_id_fkey
      FOREIGN KEY (voucher_id)
      REFERENCES public.saas_admin_vouchers(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saas_admin_voucher_audit_logs_redemption_id_fkey'
  ) THEN
    ALTER TABLE public.saas_admin_voucher_audit_logs
      ADD CONSTRAINT saas_admin_voucher_audit_logs_redemption_id_fkey
      FOREIGN KEY (redemption_id)
      REFERENCES public.saas_admin_voucher_redemptions(id)
      ON DELETE SET NULL;
  END IF;
END $$;