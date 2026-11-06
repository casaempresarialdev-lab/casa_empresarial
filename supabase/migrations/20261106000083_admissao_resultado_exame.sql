-- Etapa "Registrar resultado do exame": resultado no próprio encaminhamento (apto ou inapto, com o ASO)
-- e o e-mail de reprovação no exame, separado do de reprovação na seleção.
ALTER TABLE admission_exams ADD COLUMN IF NOT EXISTS resultado TEXT CHECK (resultado IN ('apto', 'inapto'));
ALTER TABLE admission_exams ADD COLUMN IF NOT EXISTS resultado_data DATE;
ALTER TABLE admission_exams ADD COLUMN IF NOT EXISTS resultado_observacoes TEXT;
-- ASO no bucket "documentos"; com apto, o mesmo arquivo vira o "Exame Admissional" do funcionário
ALTER TABLE admission_exams ADD COLUMN IF NOT EXISTS aso_path TEXT;
ALTER TABLE admission_exams ADD COLUMN IF NOT EXISTS resultado_por TEXT;
ALTER TABLE admission_exams ADD COLUMN IF NOT EXISTS resultado_em TIMESTAMPTZ;

ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS exame_reprovacao_notificar BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS exame_reprovacao_assunto TEXT;
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS exame_reprovacao_modelo TEXT;

NOTIFY pgrst, 'reload schema';
