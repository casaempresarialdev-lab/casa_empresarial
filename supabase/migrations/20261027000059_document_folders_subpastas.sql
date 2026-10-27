-- Subpastas na Documentação: cada pasta pode ficar dentro de outra (parent_id nulo = raiz)
-- Pastas padrão ficam sempre na raiz (não podem ser movidas)
ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES document_folders(id) ON DELETE SET NULL;

ALTER TABLE document_folders DROP CONSTRAINT IF EXISTS document_folders_padrao_na_raiz;
ALTER TABLE document_folders ADD CONSTRAINT document_folders_padrao_na_raiz CHECK (NOT sistema OR parent_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id ON document_folders(parent_id);
