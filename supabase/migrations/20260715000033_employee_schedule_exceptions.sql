-- Exceções manuais de escala (folgas avulsas ou overrides pontuais)
CREATE TABLE employee_schedule_exceptions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data        DATE        NOT NULL,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('folga', 'trabalho')),
  observacao  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, data)
);

ALTER TABLE employee_schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members select schedule exceptions"
  ON employee_schedule_exceptions FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "members insert schedule exceptions"
  ON employee_schedule_exceptions FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "members update schedule exceptions"
  ON employee_schedule_exceptions FOR UPDATE
  USING (is_company_member(company_id));

CREATE POLICY "members delete schedule exceptions"
  ON employee_schedule_exceptions FOR DELETE
  USING (is_company_member(company_id));

CREATE INDEX idx_ese_company  ON employee_schedule_exceptions(company_id);
CREATE INDEX idx_ese_employee ON employee_schedule_exceptions(employee_id);
CREATE INDEX idx_ese_data     ON employee_schedule_exceptions(data);
