-- Rescisão em kanban, no molde da admissão (ver app/(app)/pessoas/rescisao/etapas.ts).
-- Um processo por desligamento; a pessoa segue na Equipe (trabalhando no aviso) até finalizar.

CREATE TABLE employee_terminations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id                 UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status                      TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'finalizada', 'cancelada')),
  etapa                       TEXT NOT NULL,
  em_espera                   BOOLEAN NOT NULL DEFAULT false,
  tipo                        TEXT NOT NULL CHECK (tipo IN ('pedido_demissao', 'sem_justa_causa', 'justa_causa', 'acordo', 'termino_contrato')),
  motivo                      TEXT,
  -- Aviso prévio
  aviso_modalidade            TEXT CHECK (aviso_modalidade IN ('trabalhado', 'indenizado', 'dispensado')),
  aviso_comunicacao           DATE,
  aviso_dias                  INT,
  ultimo_dia                  DATE,
  -- Contabilidade (externa)
  contabilidade_enviada_em    TIMESTAMPTZ,
  contabilidade_enviada_por   TEXT,
  contabilidade_retorno_em    TIMESTAMPTZ,
  -- Fim
  trct_path                   TEXT,
  data_desligamento           DATE,
  finalizada_em               TIMESTAMPTZ,
  cancelada_motivo            TEXT,
  iniciada_por                UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Só um processo em andamento por pessoa
CREATE UNIQUE INDEX uq_employee_terminations_ativa ON employee_terminations (employee_id) WHERE status = 'em_andamento';
CREATE INDEX idx_employee_terminations_company ON employee_terminations (company_id, status);

ALTER TABLE employee_terminations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_terminations_policy" ON employee_terminations USING (is_company_member(company_id));

-- Exame demissional (as clínicas são as da admissão: admission_clinics)
CREATE TABLE termination_exams (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  termination_id     UUID NOT NULL REFERENCES employee_terminations(id) ON DELETE CASCADE,
  clinic_id          UUID REFERENCES admission_clinics(id) ON DELETE SET NULL,
  clinica_nome       TEXT NOT NULL,
  clinica_endereco   TEXT,
  clinica_telefone   TEXT,
  data_hora          TIMESTAMPTZ,
  orientacoes        TEXT,
  status             TEXT NOT NULL DEFAULT 'encaminhado' CHECK (status IN ('encaminhado', 'realizado', 'substituido')),
  email_enviado      BOOLEAN NOT NULL DEFAULT false,
  resultado          TEXT CHECK (resultado IN ('apto', 'inapto')),
  resultado_data     DATE,
  resultado_observacoes TEXT,
  aso_path           TEXT,
  resultado_por      TEXT,
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termination_exams_termination ON termination_exams (termination_id, created_at DESC);
ALTER TABLE termination_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "termination_exams_policy" ON termination_exams USING (is_company_member(company_id));

-- Anotações e eventos (linha do tempo da ficha de rescisão)
CREATE TABLE termination_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  termination_id  UUID NOT NULL REFERENCES employee_terminations(id) ON DELETE CASCADE,
  texto           TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'evento' CHECK (tipo IN ('anotacao', 'evento')),
  autor_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  autor_nome      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termination_notes_termination ON termination_notes (termination_id, created_at);
ALTER TABLE termination_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "termination_notes_policy" ON termination_notes USING (is_company_member(company_id));

-- Configurações da rescisão (etapas e e-mail do exame demissional)
CREATE TABLE termination_settings (
  company_id     UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  etapas         JSONB,
  exame_notificar BOOLEAN NOT NULL DEFAULT true,
  exame_assunto  TEXT,
  exame_modelo   TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE termination_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "termination_settings_policy" ON termination_settings USING (is_company_member(company_id));

-- Arquivos do funcionário gerados na rescisão
ALTER TABLE employees ADD COLUMN IF NOT EXISTS doc_exame_demissional_path TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS doc_trct_path TEXT;

NOTIFY pgrst, 'reload schema';
