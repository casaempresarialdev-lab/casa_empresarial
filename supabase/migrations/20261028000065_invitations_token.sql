-- Convite próprio (sem o e-mail do Supabase): link único /convite/<token> enviado pelo SMTP do sistema.
-- Só o hash (sha256) do token fica no banco; o link vale até expires_at e deixa de valer ao ser usado.
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token_hash
  ON invitations (token_hash)
  WHERE token_hash IS NOT NULL;
