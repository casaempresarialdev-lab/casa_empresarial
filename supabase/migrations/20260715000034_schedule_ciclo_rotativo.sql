-- Ciclo rotativo configurável: substitui o tipo fixo '12x36' por 'ciclo'
-- com campos ciclo_trabalho_dias e ciclo_folga_dias configuráveis pelo usuário.

ALTER TABLE employee_schedule_rules
  ADD COLUMN IF NOT EXISTS ciclo_trabalho_dias INTEGER,
  ADD COLUMN IF NOT EXISTS ciclo_folga_dias    INTEGER;

-- Atualiza o CHECK constraint para 'ciclo' no lugar de '12x36'
ALTER TABLE employee_schedule_rules
  DROP CONSTRAINT IF EXISTS employee_schedule_rules_tipo_escala_check;

ALTER TABLE employee_schedule_rules
  ADD CONSTRAINT employee_schedule_rules_tipo_escala_check
  CHECK (tipo_escala IN ('semanal', 'ciclo'));
