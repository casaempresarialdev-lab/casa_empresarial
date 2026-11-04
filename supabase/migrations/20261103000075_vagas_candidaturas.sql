-- Vagas e candidaturas (início do fluxo de admissão).
-- A vaga gera um link público (token) para candidatura; o candidato só vira funcionário ao ser selecionado.
CREATE TABLE job_openings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  titulo         TEXT NOT NULL,
  descricao      TEXT,
  cargo          TEXT,
  departamento   TEXT,
  local_trabalho TEXT,
  tipo_contrato  TEXT NOT NULL CHECK (tipo_contrato IN ('clt', 'pj', 'estagio', 'menor_aprendiz', 'autonomo')),
  salario        NUMERIC(12, 2),
  exibir_salario BOOLEAN NOT NULL DEFAULT false,
  posicoes       INT NOT NULL DEFAULT 1 CHECK (posicoes >= 1),
  data_limite    DATE,
  status         TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'pausada', 'encerrada')),
  encerrada_em   TIMESTAMPTZ,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_openings_company ON job_openings (company_id, status);

ALTER TABLE job_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_openings_policy" ON job_openings USING (is_company_member(company_id));

-- Benefícios oferecidos na vaga (usados depois na carta proposta)
CREATE TABLE job_opening_benefits (
  vaga_id    UUID NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
  benefit_id UUID NOT NULL REFERENCES company_benefits(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (vaga_id, benefit_id)
);

ALTER TABLE job_opening_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_opening_benefits_policy" ON job_opening_benefits USING (is_company_member(company_id));

CREATE TABLE job_applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vaga_id     UUID NOT NULL REFERENCES job_openings(id) ON DELETE RESTRICT,
  nome        TEXT NOT NULL,
  cpf         TEXT NOT NULL,
  email       TEXT NOT NULL,
  telefone    TEXT NOT NULL,
  anexo_path  TEXT NOT NULL,
  anexo_nome  TEXT NOT NULL,
  anexo_tipo  TEXT,
  status      TEXT NOT NULL DEFAULT 'nova'
              CHECK (status IN ('nova', 'selecionada', 'reprovada', 'desistiu', 'processo_encerrado')),
  motivo      TEXT,
  -- Aceite do uso dos dados (LGPD) e prazo de guarda de quem não foi contratado
  aceite_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aceite_ip   TEXT,
  guardar_ate DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '12 months'),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vaga_id, cpf)
);

CREATE INDEX idx_job_applications_company ON job_applications (company_id, status);
CREATE INDEX idx_job_applications_vaga ON job_applications (vaga_id, created_at DESC);
CREATE INDEX idx_job_applications_guardar ON job_applications (guardar_ate);
CREATE INDEX idx_job_applications_ip ON job_applications (vaga_id, aceite_ip, created_at);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_applications_policy" ON job_applications USING (is_company_member(company_id));
