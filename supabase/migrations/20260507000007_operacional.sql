-- ============================================================
-- SPRINT 7 — Módulo Operacional + Frente de Caixa (PDV)
-- ============================================================

-- ------------------------------------------------------------
-- PRODUCTS (Produtos e Serviços com Estoque)
-- ------------------------------------------------------------
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  descricao       TEXT,
  sku             TEXT,
  codigo_barras   TEXT,
  categoria       TEXT,
  tipo            TEXT DEFAULT 'produto' CHECK (tipo IN ('produto', 'servico')),
  preco_venda     DECIMAL(12,2),
  preco_custo     DECIMAL(12,2),
  margem          DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN preco_custo > 0 THEN ROUND(((preco_venda - preco_custo) / preco_custo * 100)::NUMERIC, 2)
      ELSE NULL
    END
  ) STORED,
  estoque_atual   INT DEFAULT 0,
  estoque_minimo  INT DEFAULT 0,
  unidade_medida  TEXT DEFAULT 'un',  -- 'un' | 'kg' | 'l' | 'm' | etc
  foto_url        TEXT,
  tags            TEXT[] DEFAULT '{}',
  ativo           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_policy" ON products
  USING (is_company_member(company_id));

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_products_company ON products (company_id);
CREATE INDEX idx_products_sku     ON products (sku);
CREATE INDEX idx_products_nome    ON products (nome);
CREATE INDEX idx_products_ativo   ON products (ativo);

-- ------------------------------------------------------------
-- PURCHASE_ORDERS (Pedidos de Compra)
-- itens como JSONB para MVP — tabela separada na v2 se necessário
-- ------------------------------------------------------------
CREATE TABLE purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  numero        SERIAL,
  fornecedor_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  data          DATE DEFAULT CURRENT_DATE,
  data_entrega  DATE,
  status        TEXT NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho', 'enviado', 'confirmado', 'recebido', 'cancelado')),
  itens         JSONB DEFAULT '[]',
  -- [{product_id, nome, qtd, preco_unitario, subtotal}]
  valor_total   DECIMAL(12,2) DEFAULT 0,
  observacao    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_orders_policy" ON purchase_orders
  USING (is_company_member(company_id));

CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_purchase_orders_company    ON purchase_orders (company_id);
CREATE INDEX idx_purchase_orders_status     ON purchase_orders (status);
CREATE INDEX idx_purchase_orders_fornecedor ON purchase_orders (fornecedor_id);

-- ------------------------------------------------------------
-- SALE_ORDERS (Pedidos de Venda)
-- ------------------------------------------------------------
CREATE TABLE sale_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  numero      SERIAL,
  cliente_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  data        DATE DEFAULT CURRENT_DATE,
  data_entrega DATE,
  status      TEXT NOT NULL DEFAULT 'rascunho'
              CHECK (status IN ('rascunho', 'confirmado', 'em_producao', 'enviado', 'entregue', 'cancelado')),
  itens       JSONB DEFAULT '[]',
  -- [{product_id, nome, qtd, preco_unitario, desconto, subtotal}]
  desconto    DECIMAL(12,2) DEFAULT 0,
  valor_total DECIMAL(12,2) DEFAULT 0,
  forma_pagamento TEXT,
  observacao  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sale_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_orders_policy" ON sale_orders
  USING (is_company_member(company_id));

CREATE TRIGGER sale_orders_updated_at
  BEFORE UPDATE ON sale_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_sale_orders_company  ON sale_orders (company_id);
CREATE INDEX idx_sale_orders_status   ON sale_orders (status);
CREATE INDEX idx_sale_orders_cliente  ON sale_orders (cliente_id);
CREATE INDEX idx_sale_orders_data     ON sale_orders (data);

-- ------------------------------------------------------------
-- CASH_SESSIONS (Sessões da Frente de Caixa / PDV)
-- Controlada por cookie pdv_session (TTL 8h) no middleware
-- ------------------------------------------------------------
CREATE TABLE cash_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opened_by        UUID NOT NULL REFERENCES profiles(id),
  opened_at        TIMESTAMPTZ DEFAULT NOW(),
  closed_at        TIMESTAMPTZ,
  saldo_abertura   DECIMAL(12,2) DEFAULT 0,
  saldo_fechamento DECIMAL(12,2),
  status           TEXT NOT NULL DEFAULT 'aberta'
                   CHECK (status IN ('aberta', 'fechada')),
  observacao       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_sessions_policy" ON cash_sessions
  USING (is_company_member(company_id));

CREATE INDEX idx_cash_sessions_company ON cash_sessions (company_id);
CREATE INDEX idx_cash_sessions_status  ON cash_sessions (status);
CREATE INDEX idx_cash_sessions_opened  ON cash_sessions (opened_by);

-- ------------------------------------------------------------
-- PDV_SALES (Vendas realizadas pelo Frente de Caixa)
-- Vinculada à cash_session ativa
-- ------------------------------------------------------------
CREATE TABLE pdv_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cash_session_id UUID NOT NULL REFERENCES cash_sessions(id),
  cliente_nome    TEXT,
  itens           JSONB DEFAULT '[]',
  -- [{product_id, nome, qtd, preco_unitario, subtotal}]
  subtotal        DECIMAL(12,2) NOT NULL,
  desconto        DECIMAL(12,2) DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL,
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'pix', 'credito', 'debito', 'outro')),
  troco           DECIMAL(12,2) DEFAULT 0,  -- apenas para pagamento em dinheiro
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pdv_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdv_sales_policy" ON pdv_sales
  USING (is_company_member(company_id));

CREATE INDEX idx_pdv_sales_company  ON pdv_sales (company_id);
CREATE INDEX idx_pdv_sales_session  ON pdv_sales (cash_session_id);
CREATE INDEX idx_pdv_sales_created  ON pdv_sales (created_at);
