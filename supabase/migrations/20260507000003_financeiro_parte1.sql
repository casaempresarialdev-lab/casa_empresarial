-- ============================================================
-- SPRINT 3 — Módulo Financeiro Parte 1
-- Contatos, Centro de Custo, Categorias, Contas, Cartões
-- ============================================================

-- ------------------------------------------------------------
-- CONTACTS (Clientes e Fornecedores)
-- ------------------------------------------------------------
CREATE TABLE contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('PF', 'PJ')),
  cpf_cnpj    TEXT,
  email       TEXT,
  telefone    TEXT,
  endereco    JSONB DEFAULT '{}',
  -- {cep, logradouro, numero, complemento, bairro, cidade, uf}
  observacao  TEXT,
  tags        TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_policy" ON contacts
  USING (is_company_member(company_id));

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_contacts_company    ON contacts (company_id);
CREATE INDEX idx_contacts_cpf_cnpj   ON contacts (cpf_cnpj);
CREATE INDEX idx_contacts_nome       ON contacts (nome);

-- ------------------------------------------------------------
-- COST_CENTERS (Centros de Custo)
-- ------------------------------------------------------------
CREATE TABLE cost_centers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  codigo       TEXT,
  responsavel  UUID REFERENCES profiles(id),
  ativo        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_centers_policy" ON cost_centers
  USING (is_company_member(company_id));

CREATE TRIGGER cost_centers_updated_at
  BEFORE UPDATE ON cost_centers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_cost_centers_company ON cost_centers (company_id);

-- ------------------------------------------------------------
-- CATEGORIES (Categorias hierárquicas de receita/despesa)
-- ------------------------------------------------------------
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  -- NULL = categoria raiz; preenchido = subcategoria
  cor         TEXT,
  icone       TEXT,
  ativo       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, nome, parent_id)
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_policy" ON categories
  USING (is_company_member(company_id));

CREATE INDEX idx_categories_company   ON categories (company_id);
CREATE INDEX idx_categories_parent    ON categories (parent_id);
CREATE INDEX idx_categories_tipo      ON categories (tipo);

-- ------------------------------------------------------------
-- BANK_ACCOUNTS (Contas Bancárias)
-- ------------------------------------------------------------
CREATE TABLE bank_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  banco          TEXT NOT NULL,
  agencia        TEXT,
  numero         TEXT,
  digito         TEXT,
  tipo           TEXT CHECK (tipo IN ('corrente', 'poupanca', 'pagamento', 'investimento', 'caixa')),
  saldo_inicial  DECIMAL(12,2) DEFAULT 0,
  saldo_atual    DECIMAL(12,2) DEFAULT 0,
  -- mantido via trigger nas transactions
  ativo          BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_policy" ON bank_accounts
  USING (is_company_member(company_id));

CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_bank_accounts_company ON bank_accounts (company_id);

-- ------------------------------------------------------------
-- CREDIT_CARDS (Cartões de Crédito)
-- ------------------------------------------------------------
CREATE TABLE credit_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  bandeira         TEXT CHECK (bandeira IN ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro')),
  limite           DECIMAL(12,2),
  dia_vencimento   INT CHECK (dia_vencimento BETWEEN 1 AND 31),
  dia_fechamento   INT CHECK (dia_fechamento BETWEEN 1 AND 31),
  ativo            BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_cards_policy" ON credit_cards
  USING (is_company_member(company_id));

CREATE TRIGGER credit_cards_updated_at
  BEFORE UPDATE ON credit_cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_credit_cards_company ON credit_cards (company_id);
