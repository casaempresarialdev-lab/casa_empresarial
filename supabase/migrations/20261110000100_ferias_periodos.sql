-- Férias: pedidos do colaborador com aprovação, vínculo com o período aquisitivo e regras configuráveis pela empresa.
-- Pode ser executada de novo sem efeito colateral.

ALTER TABLE employee_vacations
  -- As férias que já existiam foram programadas pela área de Pessoas: ficam aprovadas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprovada' CHECK (status IN ('solicitada', 'aprovada', 'recusada', 'cancelada')),
  -- Início do período aquisitivo a que as férias pertencem; vazio nas antigas (o sistema deduz pela data)
  ADD COLUMN IF NOT EXISTS periodo_inicio DATE,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'gestor' CHECK (origem IN ('colaborador', 'gestor')),
  ADD COLUMN IF NOT EXISTS solicitado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resposta TEXT,
  ADD COLUMN IF NOT EXISTS decidido_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS decidido_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_employee_vacations_employee ON employee_vacations (employee_id, status);

ALTER TABLE payroll_settings
  ADD COLUMN IF NOT EXISTS ferias_solicitacao_ativa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ferias_antecedencia_dias INTEGER NOT NULL DEFAULT 30 CHECK (ferias_antecedencia_dias BETWEEN 0 AND 120),
  ADD COLUMN IF NOT EXISTS ferias_permite_fracionar BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ferias_permite_abono BOOLEAN NOT NULL DEFAULT TRUE;

NOTIFY pgrst, 'reload schema';
