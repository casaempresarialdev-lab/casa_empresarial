-- Folha: DSR, adicional noturno, insalubridade por cargo, recibos próprios (férias e 13º) e holerites enviados pela contabilidade.
-- Pode ser executada de novo sem efeito colateral.

ALTER TABLE payroll_settings
  -- DSR: reflexo das horas extras e do adicional noturno; perda do descanso da semana com falta sem justificativa
  ADD COLUMN IF NOT EXISTS dsr_reflexo_ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS dsr_desconta_falta     BOOLEAN NOT NULL DEFAULT TRUE,
  -- Adicional noturno (art. 73 da CLT): 22h às 5h, 20%, hora de 52min30s
  ADD COLUMN IF NOT EXISTS noturno_ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS noturno_inicio         TEXT NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS noturno_fim            TEXT NOT NULL DEFAULT '05:00',
  ADD COLUMN IF NOT EXISTS noturno_percentual     NUMERIC(5,2) NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS noturno_hora_reduzida  BOOLEAN NOT NULL DEFAULT TRUE,
  -- Insalubridade: o grau é do cargo; a base é da empresa (salário mínimo, salvo convenção)
  ADD COLUMN IF NOT EXISTS insalubridade_base     TEXT NOT NULL DEFAULT 'salario_minimo',
  ADD COLUMN IF NOT EXISTS salario_minimo         NUMERIC(10,2) NOT NULL DEFAULT 1621.00,
  -- De onde vem o holerite que o colaborador vê: o gerado pelo sistema ou o PDF enviado pela contabilidade
  ADD COLUMN IF NOT EXISTS holerite_fonte         TEXT NOT NULL DEFAULT 'sistema';

DO $$ BEGIN
  ALTER TABLE payroll_settings ADD CONSTRAINT payroll_settings_insalubridade_base_check CHECK (insalubridade_base IN ('salario_minimo', 'salario_base'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE payroll_settings ADD CONSTRAINT payroll_settings_holerite_fonte_check CHECK (holerite_fonte IN ('sistema', 'arquivo'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Adicional do cargo: insalubridade (10, 20 ou 40%) ou periculosidade (30%). A CLT não deixa acumular os dois.
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS adicional TEXT NOT NULL DEFAULT 'nenhum';
DO $$ BEGIN
  ALTER TABLE job_positions ADD CONSTRAINT job_positions_adicional_check CHECK (adicional IN ('nenhum', 'insalubridade_10', 'insalubridade_20', 'insalubridade_40', 'periculosidade'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recibos fora da folha mensal: férias (pagas 2 dias antes do início) e as duas parcelas do 13º.
-- "dados" guarda o cálculo congelado: linhas do recibo, bases e totais.
CREATE TABLE IF NOT EXISTS payroll_receipts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo              TEXT NOT NULL CHECK (tipo IN ('ferias', 'decimo_1', 'decimo_2')),
  -- Férias: o id da programação; 13º: o ano
  referencia        TEXT NOT NULL,
  vacation_id       UUID REFERENCES employee_vacations(id) ON DELETE CASCADE,
  pagamento_em      DATE NOT NULL,
  liquido           NUMERIC(12,2) NOT NULL DEFAULT 0,
  dados             JSONB NOT NULL,
  fechado_por_nome  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, tipo, referencia)
);

CREATE INDEX IF NOT EXISTS idx_payroll_receipts_company ON payroll_receipts (company_id, tipo, referencia);
ALTER TABLE payroll_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_receipts_policy" ON payroll_receipts;
CREATE POLICY "payroll_receipts_policy" ON payroll_receipts USING (is_company_member(company_id));

-- Holerites em PDF enviados pela contabilidade, por pessoa e competência
CREATE TABLE IF NOT EXISTS payroll_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  competencia       TEXT NOT NULL,
  tipo              TEXT NOT NULL DEFAULT 'mensal' CHECK (tipo IN ('mensal', 'ferias', 'decimo_1', 'decimo_2', 'outro')),
  arquivo_path      TEXT NOT NULL,
  arquivo_nome      TEXT NOT NULL,
  enviado_por_nome  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_documents_employee ON payroll_documents (employee_id, competencia DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_documents_company ON payroll_documents (company_id, competencia);
ALTER TABLE payroll_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_documents_policy" ON payroll_documents;
CREATE POLICY "payroll_documents_policy" ON payroll_documents USING (is_company_member(company_id));

-- Notificações de folha (holerite e 13º disponíveis), caso a 20261110000101 já tenha rodado sem esse tipo
DO $$ BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_tipo_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_tipo_check CHECK (tipo IN ('ponto', 'ausencia', 'ferias', 'folha', 'saude'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
