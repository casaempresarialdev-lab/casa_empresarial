-- ============================================================
-- Menu lateral flexível (Estrutura base — Fase B)
-- Árvore de 2 níveis por empresa: área (nível 1) -> sub-área (nível 2).
-- Itens nativos (do catálogo do produto) são semeados como linhas reais na
-- primeira vez que a empresa abre o menu — mesmo padrão de lazy-seed já usado
-- em company_admission_stages/company_encargos_aliquotas. "key" é a chave
-- estável do catálogo (não muda ao renomear); label NULL = usa o rótulo
-- padrão do catálogo, só grava algo aqui quando a empresa realmente renomeia.
-- ============================================================

CREATE TABLE company_menu_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES company_menu_items(id) ON DELETE CASCADE,
  key         TEXT,
  natureza    TEXT NOT NULL DEFAULT 'personalizada' CHECK (natureza IN ('nativa', 'personalizada')),
  tipo        TEXT NOT NULL CHECK (tipo IN ('area', 'pasta', 'formulario', 'kanban', 'fluxograma', 'documento')),
  label       TEXT,
  icon        TEXT NOT NULL DEFAULT '📁',
  href        TEXT,
  ordem       INT NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

ALTER TABLE company_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_menu_items_policy" ON company_menu_items
  USING (is_company_member(company_id));

CREATE INDEX idx_company_menu_items_company ON company_menu_items (company_id, parent_id, ordem);

-- "Pasta" (sub-área personalizada) reaproveita a tabela de documentos que já
-- existe — menu_item_id fica NULL pros documentos antigos de Documentação.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES company_menu_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_menu_item ON documents (menu_item_id);
