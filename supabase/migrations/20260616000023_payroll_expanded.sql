-- Sprint 11: Expand payroll_entries with new fields per Carol's spec
ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS horas_extras_feriado  DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periculosidade_valor   DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_adiantamento  DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_trabalhados       INTEGER;
