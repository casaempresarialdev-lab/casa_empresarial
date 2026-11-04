-- Etapa "Enviar carta proposta": configuração por empresa, cartas enviadas e registro do aceite.

-- Configurações de admissão (sem linha = valores padrão do sistema)
CREATE TABLE admission_settings (
  company_id           UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  carta_assunto        TEXT,
  carta_modelo         TEXT,
  carta_validade_dias  INT NOT NULL DEFAULT 7 CHECK (carta_validade_dias BETWEEN 1 AND 60),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admission_settings_policy" ON admission_settings USING (is_company_member(company_id));

-- Cada carta enviada. "conteudo" é o texto como o candidato leu (não muda depois do envio).
CREATE TABLE admission_offers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id    UUID REFERENCES employees(id) ON DELETE SET NULL,
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  token          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  assunto        TEXT NOT NULL,
  conteudo       TEXT NOT NULL,
  cargo          TEXT,
  salario        NUMERIC(12, 2),
  data_inicio    DATE NOT NULL,
  local_trabalho TEXT,
  beneficios     TEXT,
  status         TEXT NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada', 'aceita', 'recusada', 'substituida')),
  expira_em      TIMESTAMPTZ NOT NULL,
  respondida_em  TIMESTAMPTZ,
  resposta_ip    TEXT,
  motivo_recusa  TEXT,
  pdf_path       TEXT,
  enviada_por    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admission_offers_employee ON admission_offers (employee_id, created_at DESC);
CREATE INDEX idx_admission_offers_application ON admission_offers (application_id);
CREATE INDEX idx_admission_offers_company ON admission_offers (company_id);

ALTER TABLE admission_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admission_offers_policy" ON admission_offers USING (is_company_member(company_id));

-- PDF da carta aceita, entre os arquivos do funcionário
ALTER TABLE employees ADD COLUMN IF NOT EXISTS doc_carta_proposta_path TEXT;

NOTIFY pgrst, 'reload schema';
