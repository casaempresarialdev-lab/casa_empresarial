-- Bucket público para o Banco de mídia de Marketing (fotos/vídeos reaproveitados em conteúdo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'midia-marketing',
  'midia-marketing',
  true,
  52428800, -- 50MB (vídeos curtos)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "midia_marketing_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'midia-marketing');

CREATE POLICY "midia_marketing_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'midia-marketing');

CREATE POLICY "midia_marketing_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'midia-marketing');

CREATE POLICY "midia_marketing_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'midia-marketing');
