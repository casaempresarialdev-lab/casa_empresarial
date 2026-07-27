-- survey_responses: respostas dos colaboradores às pesquisas de clima
CREATE TABLE IF NOT EXISTS survey_responses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id    UUID        NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respostas    JSONB       NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Membros da empresa podem ler as respostas das suas pesquisas
CREATE POLICY "company members read survey responses"
  ON survey_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM surveys s
      INNER JOIN company_members cm ON cm.company_id = s.company_id
      WHERE s.id = survey_responses.survey_id
        AND cm.profile_id = auth.uid()
    )
  );

-- Qualquer um pode submeter resposta (anônimo — usado via admin client)
CREATE POLICY "public insert survey responses"
  ON survey_responses FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_submitted_at ON survey_responses(submitted_at DESC);
