-- ============================================================
-- SPRINT 4 — Módulo Financeiro Parte 2 (DIFERENCIAL CRÍTICO)
-- Lançamentos (Fluxo de Caixa) com recorrência + Faturas
-- ============================================================

-- ------------------------------------------------------------
-- TRANSACTIONS (Lançamentos — entidade central do produto)
-- ------------------------------------------------------------
CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  descricao        TEXT NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('pagamento', 'recebimento')),
  valor            DECIMAL(12,2) NOT NULL CHECK (valor > 0),
  data_competencia DATE NOT NULL,
  data_vencimento  DATE,
  data_pagamento   DATE,  -- preenchida ao marcar como pago

  -- Vínculos
  categoria_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  account_id       UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  card_id          UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  cost_center_id   UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,

  status           TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'pago', 'cancelado', 'conciliado')),

  detalhes         TEXT,
  anexo_url        TEXT,  -- Supabase Storage

  -- Recorrência — DIFERENCIAL CRÍTICO
  -- recorrente = TRUE ativa o motor de parcelas
  recorrente         BOOLEAN DEFAULT FALSE,
  recorrencia_tipo   TEXT CHECK (recorrencia_tipo IN ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  recorrencia_fim    DATE,    -- NULL = infinito (diferencial: sem limite de parcelas)
  recorrencia_total  INT,     -- NULL = infinito | número = quantidade de parcelas
  parcela_numero     INT,     -- 1, 2, 3... NULL se não for série
  parcela_total      INT,     -- total de parcelas da série (NULL se infinito)
  parent_id          UUID REFERENCES transactions(id) ON DELETE SET NULL,
  -- parent_id aponta para o lançamento raiz da série

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_policy" ON transactions
  USING (is_company_member(company_id));

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_transactions_company        ON transactions (company_id);
CREATE INDEX idx_transactions_tipo           ON transactions (tipo);
CREATE INDEX idx_transactions_status         ON transactions (status);
CREATE INDEX idx_transactions_data_venc      ON transactions (data_vencimento);
CREATE INDEX idx_transactions_data_comp      ON transactions (data_competencia);
CREATE INDEX idx_transactions_parent         ON transactions (parent_id);
CREATE INDEX idx_transactions_categoria      ON transactions (categoria_id);
CREATE INDEX idx_transactions_contact        ON transactions (contact_id);
-- Índice composto para o dashboard (empresa + tipo + status + data)
CREATE INDEX idx_transactions_dashboard      ON transactions (company_id, tipo, status, data_competencia DESC);

-- ------------------------------------------------------------
-- CARD_INVOICES (Faturas de Cartão)
-- ------------------------------------------------------------
CREATE TABLE card_invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  card_id     UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  mes_ano     TEXT NOT NULL,  -- formato 'YYYY-MM'
  valor_total DECIMAL(12,2) DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'aberta'
              CHECK (status IN ('aberta', 'fechada', 'paga')),
  data_vencimento DATE,
  data_pagamento  DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (card_id, mes_ano)
);

ALTER TABLE card_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_invoices_policy" ON card_invoices
  USING (is_company_member(company_id));

CREATE TRIGGER card_invoices_updated_at
  BEFORE UPDATE ON card_invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_card_invoices_company ON card_invoices (company_id);
CREATE INDEX idx_card_invoices_card    ON card_invoices (card_id);
CREATE INDEX idx_card_invoices_mes_ano ON card_invoices (mes_ano);
