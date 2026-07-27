GRANT INSERT ON public.payment_receipts TO anon;

CREATE POLICY "Public customers can submit receipts"
ON public.payment_receipts FOR INSERT TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = tenant_id)
  AND appointment_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_id AND a.tenant_id = payment_receipts.tenant_id
  )
);

CREATE POLICY "Public customers can upload receipt files"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id::text = (storage.foldername(name))[1]
  )
);