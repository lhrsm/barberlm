-- Fix Storage RLS policies for barber-avatars to allow folder-based organization
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own avatar folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;

CREATE POLICY "Users can upload own assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '-%')
  )
);

CREATE POLICY "Users can update own assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '-%')
  )
)
WITH CHECK (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '-%')
  )
);

CREATE POLICY "Users can delete own assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'barber-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name LIKE (auth.uid()::text || '-%')
  )
);
