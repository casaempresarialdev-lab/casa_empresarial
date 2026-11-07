-- Etapas do processo de admissão escolhidas pela empresa, na ordem (ver app/(app)/pessoas/admissao/etapas.ts).
-- Padrão: {"key": "encaminhar_exame", "ativo": false}. Personalizada (controle interno): {"key": "custom_...", "label": "..."}.
-- NULL: fluxo padrão, com todas as etapas.
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS etapas JSONB;
