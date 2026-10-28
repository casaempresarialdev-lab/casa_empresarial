-- PIN de segurança do usuário (6 dígitos) para confirmar operações internas.
-- Guardado só como hash (scrypt, com salt): nunca é possível ler o PIN de volta.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_pin_hash text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_pin_updated_at timestamptz;
-- Proteção contra tentativa e erro: após várias falhas seguidas, o PIN fica bloqueado por um tempo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_pin_falhas int NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_pin_bloqueado_ate timestamptz;
