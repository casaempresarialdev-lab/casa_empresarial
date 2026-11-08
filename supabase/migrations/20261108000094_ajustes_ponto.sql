-- Ajuste manual de ponto pedido pelo colaborador: guarda os horários propostos e o motivo, e só altera o registro depois de aprovado.
-- Pode ser executada de novo sem efeito colateral.

CREATE TABLE IF NOT EXISTS time_adjustments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data             DATE NOT NULL,
  entrada          TIMESTAMPTZ,
  saida_almoco     TIMESTAMPTZ,
  retorno_almoco   TIMESTAMPTZ,
  saida            TIMESTAMPTZ,
  motivo           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  resposta         TEXT,
  solicitado_por   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decidido_por     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decidido_por_nome TEXT,
  decidido_em      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Um pedido em análise por dia
CREATE UNIQUE INDEX IF NOT EXISTS uq_time_adjustments_pendente ON time_adjustments (employee_id, data) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_time_adjustments_company ON time_adjustments (company_id, status);
CREATE INDEX IF NOT EXISTS idx_time_adjustments_employee ON time_adjustments (employee_id, data);

ALTER TABLE time_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "time_adjustments_policy" ON time_adjustments;
CREATE POLICY "time_adjustments_policy" ON time_adjustments USING (is_company_member(company_id));

NOTIFY pgrst, 'reload schema';
