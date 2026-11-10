-- Feriados por empresa: os que ela acrescenta (municipais, estaduais, recessos) e os nacionais que ela não considera.
-- Pode ser executada de novo sem efeito colateral.

CREATE TABLE IF NOT EXISTS company_holidays (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data       DATE NOT NULL,
  nome       TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'adicionado' CHECK (tipo IN ('adicionado', 'removido')),
  -- Só para os adicionados: repete todo ano na mesma data
  recorrente BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, data, tipo)
);

CREATE INDEX IF NOT EXISTS idx_company_holidays_company ON company_holidays (company_id);

ALTER TABLE company_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_holidays_policy" ON company_holidays;
CREATE POLICY "company_holidays_policy" ON company_holidays USING (is_company_member(company_id));

NOTIFY pgrst, 'reload schema';
