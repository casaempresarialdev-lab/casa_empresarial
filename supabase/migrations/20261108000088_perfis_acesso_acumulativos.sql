-- Perfis de acesso acumulativos: um usuário pode ter vários, e o acesso é a soma de todos.
-- Dois perfis padrão, com cadeado: Administrador (acesso total) e Funcionário (só Minha conta e Cofre de senhas,
-- que são liberados para qualquer usuário; por isso, nenhum item).

ALTER TABLE access_profiles ADD COLUMN IF NOT EXISTS padrao TEXT CHECK (padrao IN ('administrador', 'funcionario'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_profiles_padrao ON access_profiles (company_id, padrao) WHERE padrao IS NOT NULL;

-- Perfis de cada usuário (perfil em uso não pode ser excluído)
CREATE TABLE member_access_profiles (
  member_id   UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES access_profiles(id) ON DELETE RESTRICT,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, profile_id)
);

CREATE INDEX idx_member_access_profiles_profile ON member_access_profiles (profile_id);
CREATE INDEX idx_member_access_profiles_company ON member_access_profiles (company_id);

ALTER TABLE member_access_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_access_profiles_policy" ON member_access_profiles USING (is_company_member(company_id));

-- Quem está ativo mantém o perfil que já tinha; convites pendentes também
INSERT INTO member_access_profiles (member_id, profile_id, company_id)
SELECT id, access_profile_id, company_id FROM company_members
WHERE access_profile_id IS NOT NULL AND status = 'active';

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS access_profile_ids UUID[] NOT NULL DEFAULT '{}';
UPDATE invitations SET access_profile_ids = ARRAY[access_profile_id] WHERE access_profile_id IS NOT NULL;

ALTER TABLE company_members DROP COLUMN IF EXISTS access_profile_id;
ALTER TABLE invitations DROP COLUMN IF EXISTS access_profile_id;

-- Perfis padrão de cada empresa. O Administrador não usa a lista de itens: tem acesso total, inclusive ao que for criado depois.
CREATE OR REPLACE FUNCTION criar_perfis_acesso_padrao(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO access_profiles (company_id, nome) VALUES
    (p_company_id, 'Administrador'),
    (p_company_id, 'Funcionário')
  ON CONFLICT DO NOTHING;

  UPDATE access_profiles SET padrao = 'administrador', permissoes = '[]'::jsonb
  WHERE company_id = p_company_id AND lower(nome) = 'administrador';

  UPDATE access_profiles SET padrao = 'funcionario', permissoes = '[]'::jsonb
  WHERE company_id = p_company_id AND lower(nome) = lower('Funcionário');
END;
$$;

SELECT criar_perfis_acesso_padrao(id) FROM companies;

-- Membro e Contador deixam de ser padrão: saem se ninguém usa; em uso, seguem como perfis comuns, para ninguém perder acesso
DELETE FROM access_profiles ap
WHERE ap.nome IN ('Membro', 'Contador')
  AND NOT EXISTS (SELECT 1 FROM member_access_profiles m WHERE m.profile_id = ap.id)
  AND NOT EXISTS (SELECT 1 FROM invitations i WHERE i.status = 'pending' AND ap.id = ANY (i.access_profile_ids));

NOTIFY pgrst, 'reload schema';
