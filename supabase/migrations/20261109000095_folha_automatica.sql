-- Folha automática: os valores vêm do ponto, da escala e dos benefícios; a tela só confere e edita.
-- Pode ser executada de novo sem efeito colateral.

ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS desconto_atrasos DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Só o que foi editado na conferência; o resto continua automático
  ADD COLUMN IF NOT EXISTS ajustes JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Base congelada quando a folha é fechada
  ADD COLUMN IF NOT EXISTS apuracao JSONB;

-- O que já foi digitado à mão nos meses abertos passa a valer como edição, para não se perder
UPDATE payroll_entries
SET ajustes = jsonb_strip_nulls(jsonb_build_object(
  'desconto_faltas',       NULLIF(desconto_faltas, 0),
  'atestados',             NULLIF(atestados, 0),
  'horas_extras',          NULLIF(horas_extras, 0),
  'horas_extras_feriado',  NULLIF(horas_extras_feriado, 0),
  'horas_extras_domingo',  NULLIF(horas_extras_domingo, 0),
  'bonus',                 NULLIF(bonus, 0),
  'desconto_vt',           NULLIF(desconto_vt, 0),
  'desconto_vr',           NULLIF(desconto_vr, 0)
))
WHERE ajustes = '{}'::jsonb AND status = 'rascunho';

-- Atestado no registro de ponto: o dia não conta como falta
ALTER TABLE time_records DROP CONSTRAINT IF EXISTS time_records_tipo_check;
ALTER TABLE time_records ADD CONSTRAINT time_records_tipo_check
  CHECK (tipo IN ('normal', 'extra', 'folga', 'ferias', 'falta', 'atestado'));

NOTIFY pgrst, 'reload schema';
