-- ============================================================
-- Permissão por área (Estrutura base — Fase A)
-- company_members.permissions (JSONB) já existia desde a fundação do projeto,
-- mas nunca foi lido por nenhuma tela nem Server Action — é "letra morta".
-- Esta migration passa a usá-lo de verdade: { administrativo, financeiro,
-- pessoas, operacional, marketing } -> 'nenhum' | 'ver' | 'editar'.
-- ============================================================

-- Backfill: membros secundários já existentes (admin/member/accountant) mantêm
-- acesso total em todas as áreas — hoje, sem enforcement nenhum, eles já viam
-- e editavam tudo. Sem isso, ativar a checagem de permissão travaria quem já
-- usa o sistema. Owner e colaborador não usam este campo (regra própria).
UPDATE company_members
SET permissions = '{"administrativo":"editar","financeiro":"editar","pessoas":"editar","operacional":"editar","marketing":"editar"}'::jsonb
WHERE role NOT IN ('owner', 'colaborador')
  AND (permissions IS NULL OR permissions = '{}'::jsonb);

-- Convite carrega a permissão escolhida pelo owner na hora do convite, pra ser
-- aplicada em company_members quando o convite for aceito (app/auth/callback).
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
