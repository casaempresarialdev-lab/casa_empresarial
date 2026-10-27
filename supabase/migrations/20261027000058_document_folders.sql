-- Pastas da Documentação
-- Pastas padrão (sistema = true) valem para todas as empresas (company_id NULL) e não podem ser editadas nem excluídas
CREATE TABLE IF NOT EXISTS document_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  sistema    boolean NOT NULL DEFAULT false,
  ordem      int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT document_folders_dono CHECK (
    (sistema AND company_id IS NULL) OR (NOT sistema AND company_id IS NOT NULL)
  )
);

ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view document folders"
  ON document_folders FOR SELECT
  USING (company_id IS NULL OR is_company_member(company_id));

CREATE POLICY "members can insert document folders"
  ON document_folders FOR INSERT
  WITH CHECK (NOT sistema AND is_company_member(company_id));

CREATE POLICY "members can update document folders"
  ON document_folders FOR UPDATE
  USING (NOT sistema AND is_company_member(company_id));

CREATE POLICY "members can delete document folders"
  ON document_folders FOR DELETE
  USING (NOT sistema AND is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_document_folders_company_id ON document_folders(company_id);

-- Pastas padrão
INSERT INTO document_folders (nome, sistema, ordem)
SELECT v.nome, true, v.ordem
FROM (VALUES
  ('Cartão CNPJ', 1),
  ('Contrato Social e alterações', 2),
  ('IM - Inscrição Municipal (Alvará)', 3),
  ('IE - Inscrição Estadual', 4),
  ('Alvará Sanitário', 5),
  ('Aprovação do Corpo de Bombeiros', 6)
) AS v(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM document_folders f WHERE f.sistema AND f.nome = v.nome
);

-- Documento → pasta (ao excluir a pasta, o documento fica sem pasta)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES document_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);
