-- Cargo do usuário que não tem ficha na Equipe (ex.: sócio, contador).
-- Quem tem ficha usa employees.position_id: uma pessoa só tem um cargo.
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_company_members_position ON company_members (position_id);

NOTIFY pgrst, 'reload schema';
