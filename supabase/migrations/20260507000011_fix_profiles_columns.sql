-- Adicionar colunas ausentes na tabela profiles
-- (a migration 000001 foi reaplicada em versão simplificada no banco live)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Trigger updated_at para profiles (se ainda não existe)
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
