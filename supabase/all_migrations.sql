-- ============================================================
-- SPRINT 1 — Fundação: Auth + Multi-tenant
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES (estende auth.users do Supabase)
-- ------------------------------------------------------------
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Usuário vê e edita apenas o próprio perfil
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger: cria profile automaticamente ao cadastrar novo usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------
-- COMPANIES (CNPJs)
-- ------------------------------------------------------------
CREATE TABLE companies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social          TEXT NOT NULL,
  nome_fantasia         TEXT,
  cnpj                  TEXT UNIQUE NOT NULL,
  inscricao_estadual    TEXT,
  inscricao_municipal   TEXT,
  regime_tributario     TEXT CHECK (regime_tributario IN ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei')),
  endereco              JSONB DEFAULT '{}',
  -- {cep, logradouro, numero, complemento, bairro, cidade, uf}
  telefone              TEXT,
  email                 TEXT,
  logo_url              TEXT,
  instagram_url         TEXT,
  cor_principal         TEXT DEFAULT '#C19A6B',
  cor_secundaria        TEXT DEFAULT '#EED9C4',
  dados_bancarios       JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_policy" ON companies
  USING (
    id IN (
      SELECT company_id FROM company_members
      WHERE profile_id = auth.uid()
      AND status = 'active'
    )
  );

-- Trigger: atualiza updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- COMPANY_MEMBERS (relação profile ↔ company com roles)
-- ------------------------------------------------------------
CREATE TABLE company_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'admin', 'member', 'accountant')),
  permissions JSONB DEFAULT '{}',
  -- ex: {"financeiro": true, "pessoas": false, "operacional": true}
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive', 'pending')),
  invited_by  UUID REFERENCES profiles(id),
  invited_at  TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, profile_id)
);

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- Membros veem os membros das empresas que pertencem
CREATE POLICY "company_members_select" ON company_members
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members cm2
      WHERE cm2.profile_id = auth.uid()
      AND cm2.status = 'active'
    )
  );

-- Apenas owner/admin podem inserir novos membros
CREATE POLICY "company_members_insert" ON company_members
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members cm2
      WHERE cm2.profile_id = auth.uid()
      AND cm2.status = 'active'
      AND cm2.role IN ('owner', 'admin')
    )
  );

-- Apenas owner/admin podem atualizar membros
CREATE POLICY "company_members_update" ON company_members
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM company_members cm2
      WHERE cm2.profile_id = auth.uid()
      AND cm2.status = 'active'
      AND cm2.role IN ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
CREATE INDEX idx_company_members_profile   ON company_members (profile_id);
CREATE INDEX idx_company_members_company   ON company_members (company_id);
CREATE INDEX idx_company_members_status    ON company_members (status);
CREATE INDEX idx_companies_cnpj            ON companies (cnpj);
-- ============================================================
-- SPRINT 2 — Módulo Administrativo
-- ============================================================

-- Macro RLS reutilizável (função helper)
CREATE OR REPLACE FUNCTION is_company_member(cid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = cid
    AND profile_id = auth.uid()
    AND status = 'active'
  );
$$;

-- ------------------------------------------------------------
-- SOCIOS (Quadro Societário)
-- ------------------------------------------------------------
CREATE TABLE socios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cpf           TEXT,
  email         TEXT,
  telefone      TEXT,
  participacao  DECIMAL(5,2) CHECK (participacao >= 0 AND participacao <= 100),
  cargo         TEXT,
  contato       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE socios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "socios_policy" ON socios
  USING (is_company_member(company_id));

CREATE TRIGGER socios_updated_at
  BEFORE UPDATE ON socios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_socios_company ON socios (company_id);

-- ------------------------------------------------------------
-- CREDENTIALS (Cofre de Logins e Senhas)
-- Senhas são criptografadas via pgcrypto antes de salvar
-- A criptografia/descriptografia é feita na camada de aplicação
-- usando a SUPABASE_SERVICE_ROLE_KEY como chave simétrica AES
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE credentials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sistema     TEXT NOT NULL,
  login       TEXT NOT NULL,
  -- senha salva criptografada: pgp_sym_encrypt(senha, chave) na aplicação
  senha_enc   TEXT NOT NULL,
  url         TEXT,
  observacao  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credentials_policy" ON credentials
  USING (is_company_member(company_id));

CREATE TRIGGER credentials_updated_at
  BEFORE UPDATE ON credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_credentials_company ON credentials (company_id);
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
-- ============================================================
-- SPRINT 5 — Módulo Pessoas / RH
-- ============================================================

-- ------------------------------------------------------------
-- EMPLOYEES (Funcionários CLT)
-- ------------------------------------------------------------
CREATE TABLE employees (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome                  TEXT NOT NULL,
  cpf                   TEXT,
  rg                    TEXT,
  telefone              TEXT,
  email                 TEXT,
  endereco              JSONB DEFAULT '{}',
  cargo                 TEXT,
  departamento          TEXT,
  salario               DECIMAL(10,2),
  status                TEXT NOT NULL DEFAULT 'admissao'
                        CHECK (status IN ('admissao', 'experiencia', 'ativo', 'inativo', 'demitido')),
  data_admissao         DATE,
  data_experiencia_fim  DATE,
  data_demissao         DATE,
  tipo_contrato         TEXT CHECK (tipo_contrato IN ('clt', 'pj', 'estagio', 'menor_aprendiz')),
  vale_transporte       BOOLEAN DEFAULT FALSE,
  vale_refeicao         BOOLEAN DEFAULT FALSE,
  plano_saude           BOOLEAN DEFAULT FALSE,
  grau_instrucao        TEXT,
  documentos            JSONB DEFAULT '{}',
  -- { rg_url, cpf_url, ctps_url, ... }
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_policy" ON employees
  USING (is_company_member(company_id));

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_employees_company ON employees (company_id);
CREATE INDEX idx_employees_status  ON employees (status);

-- ------------------------------------------------------------
-- SERVICE_PROVIDERS (Prestadores de Serviço)
-- ------------------------------------------------------------
CREATE TABLE service_providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  tipo        TEXT CHECK (tipo IN ('PF', 'PJ')) DEFAULT 'PJ',
  cpf_cnpj    TEXT,
  email       TEXT,
  telefone    TEXT,
  servico     TEXT,
  valor       DECIMAL(10,2),
  documentos  JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_providers_policy" ON service_providers
  USING (is_company_member(company_id));

CREATE TRIGGER service_providers_updated_at
  BEFORE UPDATE ON service_providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_service_providers_company ON service_providers (company_id);

-- ------------------------------------------------------------
-- TIME_RECORDS (Registro de Ponto)
-- Nota: para turnos que cruzam meia-noite, entrada e saida
-- são armazenadas como TIMESTAMPTZ para evitar problemas de cálculo
-- ------------------------------------------------------------
CREATE TABLE time_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data              DATE NOT NULL,
  entrada           TIMESTAMPTZ,
  saida             TIMESTAMPTZ,
  horas_trabalhadas INTERVAL GENERATED ALWAYS AS (saida - entrada) STORED,
  horas_extras      INTERVAL,  -- calculado pela aplicação
  tipo              TEXT DEFAULT 'normal' CHECK (tipo IN ('normal', 'extra', 'folga', 'ferias', 'falta')),
  foto_url          TEXT,
  localizacao       JSONB,   -- {lat, lng}
  observacao        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE time_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_records_policy" ON time_records
  USING (is_company_member(company_id));

CREATE INDEX idx_time_records_company   ON time_records (company_id);
CREATE INDEX idx_time_records_employee  ON time_records (employee_id);
CREATE INDEX idx_time_records_data      ON time_records (data);

-- ------------------------------------------------------------
-- WORK_SCHEDULES (Escala de Trabalho)
-- ------------------------------------------------------------
CREATE TABLE work_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data        DATE NOT NULL,
  turno       TEXT,          -- 'manha' | 'tarde' | 'noite' | custom
  hora_inicio TIME,
  hora_fim    TIME,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, data)
);

ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_schedules_policy" ON work_schedules
  USING (is_company_member(company_id));

CREATE INDEX idx_work_schedules_company   ON work_schedules (company_id);
CREATE INDEX idx_work_schedules_employee  ON work_schedules (employee_id);
CREATE INDEX idx_work_schedules_data      ON work_schedules (data);

-- ------------------------------------------------------------
-- SURVEYS (Pesquisas de Clima Organizacional)
-- ------------------------------------------------------------
CREATE TABLE surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  perguntas   JSONB DEFAULT '[]',
  -- [{id, texto, tipo: 'escala'|'texto'|'multipla', opcoes: []}]
  status      TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativo', 'encerrado')),
  data_inicio DATE,
  data_fim    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surveys_policy" ON surveys
  USING (is_company_member(company_id));

CREATE TRIGGER surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_surveys_company ON surveys (company_id);

-- ------------------------------------------------------------
-- MEETINGS (Reuniões — usado em Pessoas e Marketing)
-- ------------------------------------------------------------
CREATE TABLE meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  modulo        TEXT NOT NULL DEFAULT 'pessoas' CHECK (modulo IN ('pessoas', 'marketing', 'geral')),
  titulo        TEXT NOT NULL,
  data          TIMESTAMPTZ,
  duracao_min   INT,
  local         TEXT,
  participantes JSONB DEFAULT '[]',
  -- [{nome, email, profile_id}]
  pauta         TEXT,
  ata           TEXT,
  status        TEXT DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'cancelada')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_policy" ON meetings
  USING (is_company_member(company_id));

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_meetings_company ON meetings (company_id);
CREATE INDEX idx_meetings_data    ON meetings (data);
CREATE INDEX idx_meetings_modulo  ON meetings (modulo);
-- ============================================================
-- SPRINT 6 — Módulo Marketing
-- ============================================================

-- ------------------------------------------------------------
-- BRAND_MANUAL (Manual da Marca)
-- Uma linha por categoria — upsert ao editar
-- ------------------------------------------------------------
CREATE TABLE brand_manual (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  categoria   TEXT NOT NULL
              CHECK (categoria IN ('conceito', 'publico-alvo', 'persona', 'tom-de-voz', 'atendimento', 'valores', 'missao', 'visao')),
  conteudo    JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, categoria)
);

ALTER TABLE brand_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_manual_policy" ON brand_manual
  USING (is_company_member(company_id));

CREATE TRIGGER brand_manual_updated_at
  BEFORE UPDATE ON brand_manual
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_brand_manual_company ON brand_manual (company_id);

-- ------------------------------------------------------------
-- EDITORIAL_CALENDAR (Calendário Editorial)
-- ------------------------------------------------------------
CREATE TABLE editorial_calendar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  titulo           TEXT NOT NULL,
  descricao        TEXT,
  data_publicacao  DATE,
  status           TEXT NOT NULL DEFAULT 'ideia'
                   CHECK (status IN ('ideia', 'em_producao', 'feito', 'publicado')),
  plataforma       TEXT,  -- 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | outro
  estrategia       TEXT,
  responsavel_id   UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE editorial_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editorial_calendar_policy" ON editorial_calendar
  USING (is_company_member(company_id));

CREATE TRIGGER editorial_calendar_updated_at
  BEFORE UPDATE ON editorial_calendar
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_editorial_company       ON editorial_calendar (company_id);
CREATE INDEX idx_editorial_data          ON editorial_calendar (data_publicacao);
CREATE INDEX idx_editorial_status        ON editorial_calendar (status);

-- ------------------------------------------------------------
-- MEDIA_ASSETS (Fotos, Vídeos, Material Gráfico, Depoimentos)
-- URLs apontam para Supabase Storage: bucket media-assets/{company_id}/
-- ------------------------------------------------------------
CREATE TABLE media_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL
              CHECK (tipo IN ('foto', 'video', 'material_grafico', 'depoimento')),
  nome        TEXT,
  descricao   TEXT,
  url         TEXT NOT NULL,
  thumbnail_url TEXT,
  tamanho     BIGINT,  -- bytes
  mime_type   TEXT,
  duracao_seg INT,     -- para vídeos
  -- para depoimentos
  cliente_nome TEXT,
  estrelas     INT CHECK (estrelas BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_policy" ON media_assets
  USING (is_company_member(company_id));

CREATE INDEX idx_media_assets_company ON media_assets (company_id);
CREATE INDEX idx_media_assets_tipo    ON media_assets (tipo);
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
