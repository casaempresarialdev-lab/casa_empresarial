-- Logo reduzida (símbolo) da empresa, usada na sidebar retraída
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_reduzida_url TEXT;
