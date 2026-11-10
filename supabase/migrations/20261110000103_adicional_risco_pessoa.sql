-- Adicional de risco da pessoa: vazio segue o cargo (job_positions.adicional); preenchido é uma exceção do laudo.
-- Pode ser executada de novo sem efeito colateral.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS adicional_risco TEXT;
DO $$ BEGIN
  ALTER TABLE employees ADD CONSTRAINT employees_adicional_risco_check CHECK (adicional_risco IS NULL OR adicional_risco IN ('nenhum', 'insalubridade_10', 'insalubridade_20', 'insalubridade_40', 'periculosidade'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Quem já estava marcado com periculosidade (campo antigo, sem tela) vira exceção explícita
UPDATE employees SET adicional_risco = 'periculosidade' WHERE tem_periculosidade = TRUE AND adicional_risco IS NULL;

NOTIFY pgrst, 'reload schema';
