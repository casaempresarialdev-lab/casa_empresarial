-- Estrutura da empresa: departamentos e cargos. Os cargos formam a hierarquia do organograma (superior_id).
-- employees.cargo/departamento e job_openings.cargo/departamento continuam existindo como cópia do cadastro,
-- porque listas, cartas, PDFs e a página pública da vaga leem esses textos.
-- Pode ser executada de novo sem efeito colateral.

CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_nome ON departments (company_id, lower(nome));
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departments_policy" ON departments;
CREATE POLICY "departments_policy" ON departments USING (is_company_member(company_id));

CREATE TABLE IF NOT EXISTS job_positions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id  UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  superior_id    UUID REFERENCES job_positions(id) ON DELETE SET NULL,
  nome           TEXT NOT NULL,
  salario_min    NUMERIC(12, 2),
  salario_max    NUMERIC(12, 2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_positions_nome ON job_positions (company_id, department_id, lower(nome));
CREATE INDEX IF NOT EXISTS idx_job_positions_company ON job_positions (company_id);
CREATE INDEX IF NOT EXISTS idx_job_positions_superior ON job_positions (superior_id);
ALTER TABLE job_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_positions_policy" ON job_positions;
CREATE POLICY "job_positions_policy" ON job_positions USING (is_company_member(company_id));

ALTER TABLE employees ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL;
ALTER TABLE job_openings ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL;
ALTER TABLE admission_offers ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employees_position ON employees (position_id);

-- Os textos que já existem viram cadastros. Cargo sem departamento vai para "Geral".
WITH textos AS (
  SELECT company_id, trim(cargo) AS cargo, trim(departamento) AS departamento FROM employees
  UNION ALL
  SELECT company_id, trim(cargo), trim(departamento) FROM job_openings
), nomes AS (
  SELECT company_id, COALESCE(NULLIF(departamento, ''), CASE WHEN NULLIF(cargo, '') IS NOT NULL THEN 'Geral' END) AS departamento
  FROM textos
)
INSERT INTO departments (company_id, nome)
SELECT company_id, min(departamento) FROM nomes WHERE departamento IS NOT NULL GROUP BY company_id, lower(departamento)
ON CONFLICT DO NOTHING;

WITH textos AS (
  SELECT company_id, trim(cargo) AS cargo, trim(departamento) AS departamento FROM employees
  UNION ALL
  SELECT company_id, trim(cargo), trim(departamento) FROM job_openings
)
INSERT INTO job_positions (company_id, department_id, nome)
SELECT t.company_id, d.id, min(t.cargo)
FROM textos t
JOIN departments d ON d.company_id = t.company_id AND lower(d.nome) = lower(COALESCE(NULLIF(t.departamento, ''), 'Geral'))
WHERE NULLIF(t.cargo, '') IS NOT NULL
GROUP BY t.company_id, d.id, lower(t.cargo)
ON CONFLICT DO NOTHING;

UPDATE employees e
SET position_id = p.id, departamento = d.nome
FROM job_positions p
JOIN departments d ON d.id = p.department_id
WHERE p.company_id = e.company_id
  AND e.position_id IS NULL
  AND lower(p.nome) = lower(trim(e.cargo))
  AND lower(d.nome) = lower(COALESCE(NULLIF(trim(e.departamento), ''), 'Geral'));

UPDATE job_openings o
SET position_id = p.id, departamento = d.nome
FROM job_positions p
JOIN departments d ON d.id = p.department_id
WHERE p.company_id = o.company_id
  AND o.position_id IS NULL
  AND lower(p.nome) = lower(trim(o.cargo))
  AND lower(d.nome) = lower(COALESCE(NULLIF(trim(o.departamento), ''), 'Geral'));

NOTIFY pgrst, 'reload schema';
