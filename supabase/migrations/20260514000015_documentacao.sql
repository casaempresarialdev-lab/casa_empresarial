-- Storage bucket para documentos (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Tabela de documentos
CREATE TABLE IF NOT EXISTS documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  storage_path text NOT NULL,
  tamanho      bigint,
  tipo         text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view their company documents"
  ON documents FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "members can insert documents"
  ON documents FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "members can delete documents"
  ON documents FOR DELETE
  USING (is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
