-- Configurações de admissão: e-mail de reprovação do candidato (sem texto = padrão do sistema)
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS reprovacao_notificar BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS reprovacao_assunto TEXT;
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS reprovacao_modelo TEXT;

NOTIFY pgrst, 'reload schema';
