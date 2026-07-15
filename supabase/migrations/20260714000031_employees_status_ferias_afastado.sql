-- Adicionar 'ferias' e 'afastado' ao CHECK constraint de employees.status
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;

ALTER TABLE employees ADD CONSTRAINT employees_status_check
  CHECK (status IN ('admissao', 'experiencia', 'ativo', 'ferias', 'afastado', 'inativo', 'demitido'));
