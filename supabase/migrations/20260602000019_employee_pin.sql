-- Adiciona PIN de acesso ao portal de registro de ponto
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS pin       TEXT,
  ADD COLUMN IF NOT EXISTS pin_ativo BOOLEAN NOT NULL DEFAULT FALSE;

-- Index para lookup rápido por PIN dentro de uma empresa
CREATE INDEX IF NOT EXISTS idx_employees_pin ON employees (company_id, pin)
  WHERE pin IS NOT NULL AND pin_ativo = TRUE;
