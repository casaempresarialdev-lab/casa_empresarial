-- Foto do sócio (caminho no bucket privado 'documentos')
ALTER TABLE socios ADD COLUMN IF NOT EXISTS foto_path TEXT;

-- Documentos de cada sócio (vários por sócio, arquivos no bucket privado 'documentos')
CREATE TABLE IF NOT EXISTS socio_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id     uuid NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  descricao    text,
  nome         text NOT NULL,
  storage_path text NOT NULL,
  tipo         text,
  tamanho      bigint,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE socio_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view their company socio documents"
  ON socio_documents FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "members can insert socio documents"
  ON socio_documents FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "members can delete socio documents"
  ON socio_documents FOR DELETE
  USING (is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_socio_documents_socio_id ON socio_documents(socio_id);
CREATE INDEX IF NOT EXISTS idx_socio_documents_company_id ON socio_documents(company_id);
