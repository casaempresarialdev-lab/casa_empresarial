-- Etapa "Encaminhar para exame": clínicas da empresa (cada uma com a própria guia de encaminhamento),
-- encaminhamentos do candidato e o e-mail enviado a ele. O exame não entra na agenda: quem vai é o candidato.

CREATE TABLE admission_clinics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  endereco    TEXT,
  telefone    TEXT,
  -- Orientações padrão ao candidato (documento com foto, jejum…), ajustáveis em cada encaminhamento
  orientacoes TEXT,
  -- Guia de encaminhamento própria da clínica (bucket "documentos"); sem ela, vale a guia geral da empresa
  guia_path   TEXT,
  guia_nome   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admission_clinics_company ON admission_clinics (company_id);
ALTER TABLE admission_clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admission_clinics_policy" ON admission_clinics USING (is_company_member(company_id));

-- Cada encaminhamento guarda uma cópia dos dados da clínica: o histórico não muda se a clínica for editada
CREATE TABLE admission_exams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id      UUID REFERENCES employees(id) ON DELETE SET NULL,
  application_id   UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  clinic_id        UUID REFERENCES admission_clinics(id) ON DELETE SET NULL,
  clinica_nome     TEXT NOT NULL,
  clinica_endereco TEXT,
  clinica_telefone TEXT,
  -- Sem data: atendimento por ordem de chegada
  data_hora        TIMESTAMPTZ,
  orientacoes      TEXT,
  status           TEXT NOT NULL DEFAULT 'encaminhado' CHECK (status IN ('encaminhado', 'realizado', 'substituido')),
  email_enviado    BOOLEAN NOT NULL DEFAULT false,
  realizado_em     TIMESTAMPTZ,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admission_exams_employee ON admission_exams (employee_id, created_at DESC);
CREATE INDEX idx_admission_exams_company ON admission_exams (company_id);
ALTER TABLE admission_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admission_exams_policy" ON admission_exams USING (is_company_member(company_id));

-- Configurações: e-mail do encaminhamento (sem texto = padrão do sistema) e guia geral
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS exame_notificar BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS exame_assunto TEXT;
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS exame_modelo TEXT;
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS exame_guia_path TEXT;
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS exame_guia_nome TEXT;

NOTIFY pgrst, 'reload schema';
