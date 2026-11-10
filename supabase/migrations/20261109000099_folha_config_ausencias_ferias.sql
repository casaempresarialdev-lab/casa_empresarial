-- Configuração da folha por empresa, atestados e ausências com abono, e programação de férias.
-- Pode ser executada de novo sem efeito colateral.

CREATE TABLE IF NOT EXISTS payroll_settings (
  company_id              UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  -- Sem dia de corte, a apuração é o mês cheio. Com ele (ex.: 20), vai do dia 21 do mês anterior ao dia 20.
  dia_corte               INTEGER CHECK (dia_corte BETWEEN 1 AND 28),
  pagamento_tipo          TEXT NOT NULL DEFAULT 'dia_util' CHECK (pagamento_tipo IN ('dia_util', 'dia_fixo')),
  pagamento_dia           INTEGER NOT NULL DEFAULT 5 CHECK (pagamento_dia BETWEEN 1 AND 28),
  adiantamento_ativo      BOOLEAN NOT NULL DEFAULT FALSE,
  adiantamento_dia        INTEGER NOT NULL DEFAULT 20 CHECK (adiantamento_dia BETWEEN 1 AND 28),
  adiantamento_percentual NUMERIC(5,2) NOT NULL DEFAULT 40 CHECK (adiantamento_percentual BETWEEN 0 AND 100),
  guias_dia               INTEGER NOT NULL DEFAULT 20 CHECK (guias_dia BETWEEN 1 AND 28),
  -- Sem dia próprio, os benefícios vencem junto com o salário
  beneficios_dia          INTEGER CHECK (beneficios_dia BETWEEN 1 AND 28),
  he_percentual           NUMERIC(5,2) NOT NULL DEFAULT 50,
  he_feriado_percentual   NUMERIC(5,2) NOT NULL DEFAULT 100,
  he_domingo_percentual   NUMERIC(5,2) NOT NULL DEFAULT 100,
  tolerancia_minutos      INTEGER NOT NULL DEFAULT 10 CHECK (tolerancia_minutos BETWEEN 0 AND 60),
  responsavel_calculo     TEXT NOT NULL DEFAULT 'contabilidade' CHECK (responsavel_calculo IN ('sistema', 'contabilidade')),
  holerite_ativo          BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_settings_policy" ON payroll_settings;
CREATE POLICY "payroll_settings_policy" ON payroll_settings USING (is_company_member(company_id));

ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS fechado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fechado_por_nome TEXT;

CREATE TABLE IF NOT EXISTS time_absences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data_inicio       DATE NOT NULL,
  data_fim          DATE NOT NULL,
  tipo              TEXT NOT NULL CHECK (tipo IN ('atestado', 'acompanhamento', 'luto', 'casamento', 'doacao_sangue', 'outro')),
  motivo            TEXT,
  anexo_path        TEXT,
  anexo_nome        TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'abonado', 'recusado')),
  resposta          TEXT,
  origem            TEXT NOT NULL DEFAULT 'colaborador' CHECK (origem IN ('colaborador', 'gestor')),
  solicitado_por    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decidido_por      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decidido_por_nome TEXT,
  decidido_em       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_time_absences_company ON time_absences (company_id, status);
CREATE INDEX IF NOT EXISTS idx_time_absences_employee ON time_absences (employee_id, data_inicio);

ALTER TABLE time_absences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "time_absences_policy" ON time_absences;
CREATE POLICY "time_absences_policy" ON time_absences USING (is_company_member(company_id));

CREATE TABLE IF NOT EXISTS employee_vacations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  dias        INTEGER NOT NULL CHECK (dias BETWEEN 1 AND 30),
  dias_abono  INTEGER NOT NULL DEFAULT 0 CHECK (dias_abono BETWEEN 0 AND 10),
  observacao  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_vacations_company ON employee_vacations (company_id, data_inicio);

ALTER TABLE employee_vacations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_vacations_policy" ON employee_vacations;
CREATE POLICY "employee_vacations_policy" ON employee_vacations USING (is_company_member(company_id));

NOTIFY pgrst, 'reload schema';
