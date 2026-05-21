-- Create a storage bucket for system assets if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('system-assets', 'system-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'system-assets');

CREATE POLICY "Admin Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'system-assets');

CREATE POLICY "Admin Update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'system-assets');

CREATE POLICY "Admin Delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'system-assets');
