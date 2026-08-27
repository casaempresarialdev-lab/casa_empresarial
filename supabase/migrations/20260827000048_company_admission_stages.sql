-- Colunas do Kanban de Admissao configuraveis por empresa (estilo Trello: adicionar,
-- renomear, recolorir, reordenar e excluir). "key" e estavel (nao muda ao renomear o
-- label) pois e o valor gravado em employees.admission_stage. "is_final" marca qual
-- coluna representa "admissao concluida" — logica que hoje dependia do texto fixo
-- 'finalizado' passa a checar essa flag.
CREATE TABLE company_admission_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#818cf8',
  ordem       INT NOT NULL DEFAULT 0,
  is_final    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, key)
);

ALTER TABLE company_admission_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_admission_stages_policy" ON company_admission_stages
  USING (is_company_member(company_id));

CREATE INDEX idx_company_admission_stages_company ON company_admission_stages (company_id, ordem);
