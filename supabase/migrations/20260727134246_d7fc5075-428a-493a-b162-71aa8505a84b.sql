CREATE POLICY "Tenant can view own receipt files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text);

CREATE POLICY "Tenant can upload own receipt files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text);

CREATE POLICY "Tenant can update own receipt files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text)
WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text);

CREATE POLICY "Tenant can delete own receipt files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text);