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
