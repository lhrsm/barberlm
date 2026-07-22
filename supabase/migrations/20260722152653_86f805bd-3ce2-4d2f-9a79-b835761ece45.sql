GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_admin_vouchers TO authenticated;
GRANT ALL ON public.saas_admin_vouchers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_admin_voucher_redemptions TO authenticated;
GRANT ALL ON public.saas_admin_voucher_redemptions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_admin_voucher_audit_logs TO authenticated;
GRANT ALL ON public.saas_admin_voucher_audit_logs TO service_role;