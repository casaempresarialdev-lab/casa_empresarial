CREATE TABLE employee_onboarding_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token       UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_tokens_token    ON employee_onboarding_tokens(token);
CREATE INDEX idx_onboarding_tokens_employee ON employee_onboarding_tokens(employee_id);
CREATE INDEX idx_onboarding_tokens_company  ON employee_onboarding_tokens(company_id);

ALTER TABLE employee_onboarding_tokens ENABLE ROW LEVEL SECURITY;
