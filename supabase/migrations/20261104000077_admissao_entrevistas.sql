-- Etapa "Realizar entrevista": entrevistas marcadas (com evento na agenda do entrevistador) e histórico de anotações.
-- Ligadas ao cadastro em admissão e à candidatura: se o candidato for reprovado o cadastro é apagado, mas o histórico
-- fica na candidatura e segue o prazo de guarda dela.
CREATE TABLE admission_interviews (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id        UUID REFERENCES employees(id) ON DELETE SET NULL,
  application_id     UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  entrevistador_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entrevistador_nome TEXT NOT NULL,
  data_hora          TIMESTAMPTZ NOT NULL,
  duracao_min        INT NOT NULL DEFAULT 60 CHECK (duracao_min > 0 AND duracao_min <= 480),
  link_reuniao       TEXT,
  status             TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'cancelada')),
  reminder_id        UUID REFERENCES reminders(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admission_interviews_employee ON admission_interviews (employee_id, data_hora DESC);
CREATE INDEX idx_admission_interviews_application ON admission_interviews (application_id);
CREATE INDEX idx_admission_interviews_company ON admission_interviews (company_id);

ALTER TABLE admission_interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admission_interviews_policy" ON admission_interviews USING (is_company_member(company_id));

CREATE TABLE admission_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id    UUID REFERENCES employees(id) ON DELETE SET NULL,
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  texto          TEXT NOT NULL,
  autor_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  autor_nome     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admission_notes_employee ON admission_notes (employee_id, created_at DESC);
CREATE INDEX idx_admission_notes_application ON admission_notes (application_id);
CREATE INDEX idx_admission_notes_company ON admission_notes (company_id);

ALTER TABLE admission_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admission_notes_policy" ON admission_notes USING (is_company_member(company_id));

NOTIFY pgrst, 'reload schema';
