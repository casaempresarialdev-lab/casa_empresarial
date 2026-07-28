-- ============================================================
-- BALANÇO PATRIMONIAL — Lançamentos Manuais
-- ============================================================

CREATE TABLE bp_lancamentos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN (
                'ativo_circulante',
                'ativo_nao_circulante',
                'passivo_circulante',
                'passivo_nao_circulante',
                'pl'
              )),
  descricao   TEXT NOT NULL,
  valor       NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bp_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bp_lancamentos_policy" ON bp_lancamentos
  USING (is_company_member(company_id));

CREATE TRIGGER bp_lancamentos_updated_at
  BEFORE UPDATE ON bp_lancamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_bp_lancamentos_company ON bp_lancamentos (company_id);
