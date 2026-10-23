-- Cor de fundo das telas da área logada (padrão: branco)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cor_fundo TEXT;
