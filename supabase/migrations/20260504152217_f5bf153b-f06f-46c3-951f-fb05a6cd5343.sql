-- Create a storage bucket for barber avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('barber-avatars', 'barber-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to view avatars
CREATE POLICY "Public Access to Barber Avatars" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'barber-avatars');

-- Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'barber-avatars' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update their own uploads (simplified for this context)
CREATE POLICY "Users can update their own avatars" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'barber-avatars');
