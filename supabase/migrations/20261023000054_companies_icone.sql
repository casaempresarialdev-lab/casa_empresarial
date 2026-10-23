-- Ícone da empresa (PNG com fundo transparente), usado no pré-loader e no favicon
ALTER TABLE companies ADD COLUMN IF NOT EXISTS icone_url TEXT;
