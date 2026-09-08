-- ============================================================
-- Ordem de Serviço — modelo enxuto (sem estoque, sem técnico,
-- sem orçamento pra aprovar, sem conversão automática em venda)
-- ============================================================

CREATE TABLE service_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  numero        SERIAL,
  cliente_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  data          DATE DEFAULT CURRENT_DATE,
  status        TEXT NOT NULL DEFAULT 'aberta'
                CHECK (status IN ('aberta', 'concluida', 'cancelada')),
  itens         JSONB DEFAULT '[]',
  -- [{descricao, valor}]
  valor_total   DECIMAL(12,2) DEFAULT 0,
  forma_pagamento TEXT,
  observacao    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_orders_policy" ON service_orders
  USING (is_company_member(company_id));

CREATE TRIGGER service_orders_updated_at
  BEFORE UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_service_orders_company  ON service_orders (company_id);
CREATE INDEX idx_service_orders_status   ON service_orders (status);
CREATE INDEX idx_service_orders_cliente  ON service_orders (cliente_id);
CREATE INDEX idx_service_orders_data     ON service_orders (data);
