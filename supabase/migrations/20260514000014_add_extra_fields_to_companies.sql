-- Novos campos na tabela companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cor_primaria TEXT DEFAULT '#C19A6B';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS certificado_digital_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS certificado_digital_senha_enc TEXT;

-- Bucket para logos (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para certificados digitais (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados', 'certificados', false)
ON CONFLICT (id) DO NOTHING;
