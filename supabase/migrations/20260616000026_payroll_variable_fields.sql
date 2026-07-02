-- Adiciona campos variáveis mensais ao payroll_entries
ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS atestados         INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_extras_domingo DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_vr       DECIMAL(10,2)  NOT NULL DEFAULT 0;
