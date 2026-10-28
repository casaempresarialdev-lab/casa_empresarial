-- Compartilhamento de credenciais do cofre de senhas entre usuários.
-- Quem recebe só visualiza (não edita, não remove, não recompartilha). Ver a senha exige o PIN de segurança.
CREATE TABLE IF NOT EXISTS credential_shares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id  uuid NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
  owner_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- E-mail de quem recebeu, para o dono ver com quem compartilhou (profiles não guarda e-mail)
  shared_with_email text NOT NULL,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (credential_id, shared_with),
  CHECK (owner_id <> shared_with)
);

ALTER TABLE credential_shares ENABLE ROW LEVEL SECURITY;

-- Dono e destinatário enxergam o compartilhamento; só o dono cria e remove
CREATE POLICY "credential_shares_select" ON credential_shares
  FOR SELECT USING (owner_id = auth.uid() OR shared_with = auth.uid());
CREATE POLICY "credential_shares_insert" ON credential_shares
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "credential_shares_delete" ON credential_shares
  FOR DELETE USING (owner_id = auth.uid());

-- Destinatário pode ler a credencial compartilhada com ele (a senha continua criptografada; revelar passa pelo servidor com PIN)
CREATE POLICY "credentials_shared_select" ON credentials
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM credential_shares s WHERE s.credential_id = credentials.id AND s.shared_with = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_credential_shares_credential ON credential_shares (credential_id);
CREATE INDEX IF NOT EXISTS idx_credential_shares_shared_with ON credential_shares (shared_with);
