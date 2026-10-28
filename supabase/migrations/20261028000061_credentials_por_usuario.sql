-- Cofre de senhas passa a ser do usuário (profile), não da empresa.
-- company_id fica opcional (só histórico); o acesso passa a ser por profile_id.
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE credentials ALTER COLUMN company_id DROP NOT NULL;

-- Excluir a empresa não apaga mais o cofre pessoal
ALTER TABLE credentials DROP CONSTRAINT IF EXISTS credentials_company_id_fkey;
ALTER TABLE credentials ADD CONSTRAINT credentials_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Credenciais que já existiam: ficam com o proprietário da empresa
-- (sem proprietário ativo, com o membro ativo mais antigo)
UPDATE credentials c
SET profile_id = (
  SELECT cm.profile_id
  FROM company_members cm
  WHERE cm.company_id = c.company_id AND cm.status = 'active'
  ORDER BY (cm.role = 'owner') DESC, cm.created_at ASC
  LIMIT 1
)
WHERE c.profile_id IS NULL;

DROP POLICY IF EXISTS "credentials_policy" ON credentials;

CREATE POLICY "credentials_owner_policy" ON credentials
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_credentials_profile ON credentials (profile_id);
