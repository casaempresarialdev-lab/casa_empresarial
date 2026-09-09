-- Campos fiscais na tabela products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tipo_fiscal TEXT CHECK (tipo_fiscal IN ('mercadoria', 'servico', 'materia_prima', 'produto_acabado')),
  ADD COLUMN IF NOT EXISTS ncm         TEXT,
  ADD COLUMN IF NOT EXISTS origem      TEXT CHECK (origem IN ('nacional', 'importado')),
  ADD COLUMN IF NOT EXISTS cest        TEXT;
