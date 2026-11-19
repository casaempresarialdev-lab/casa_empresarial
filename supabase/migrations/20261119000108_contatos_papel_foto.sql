-- Contatos: campo de papel (cliente/fornecedor/ambos) e foto, pra ficha rica em Operacional.
-- Nenhuma tela hoje distingue cliente de fornecedor — purchase_orders.fornecedor_id e
-- sale_orders.cliente_id já guardam isso implicitamente, então o backfill abaixo infere o
-- papel de cada contato existente a partir do uso real, sem precisar perguntar pra ninguém.

ALTER TABLE contacts ADD COLUMN papel TEXT NOT NULL DEFAULT 'ambos'
  CHECK (papel IN ('cliente', 'fornecedor', 'ambos'));
ALTER TABLE contacts ADD COLUMN foto_url TEXT;

-- Só apareceu em pedido de compra → fornecedor
UPDATE contacts c SET papel = 'fornecedor'
  WHERE EXISTS (SELECT 1 FROM purchase_orders po WHERE po.fornecedor_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM sale_orders so WHERE so.cliente_id = c.id);

-- Só apareceu em pedido de venda → cliente
UPDATE contacts c SET papel = 'cliente'
  WHERE EXISTS (SELECT 1 FROM sale_orders so WHERE so.cliente_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM purchase_orders po WHERE po.fornecedor_id = c.id);

-- Apareceu nos dois, ou nunca foi usado em nenhum pedido: fica 'ambos' (valor padrão, sem mudança)

-- Bucket público de foto de contato (mesmo padrão de avatars/produtos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contatos', 'contatos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "contatos_foto_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contatos');

CREATE POLICY "contatos_foto_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'contatos');

CREATE POLICY "contatos_foto_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contatos');

CREATE POLICY "contatos_foto_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'contatos');

NOTIFY pgrst, 'reload schema';
