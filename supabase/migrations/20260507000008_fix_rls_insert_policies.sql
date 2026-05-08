-- ============================================================
-- FIX: Políticas RLS de INSERT — companies e company_members
-- Problema: novos usuários não conseguiam criar sua primeira empresa
-- ============================================================

-- Permite qualquer usuário autenticado criar uma empresa
CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Atualiza política de INSERT de company_members:
-- Permite inserir o próprio usuário como owner (primeiro vínculo)
-- OU permite owner/admin adicionar outros membros
DROP POLICY "company_members_insert" ON company_members;

CREATE POLICY "company_members_insert" ON company_members
  FOR INSERT WITH CHECK (
    -- Caso 1: usuário vinculando a si mesmo como owner de uma nova empresa
    (profile_id = auth.uid() AND role = 'owner')
    OR
    -- Caso 2: owner/admin adicionando terceiros a uma empresa existente
    company_id IN (
      SELECT company_id FROM company_members cm2
      WHERE cm2.profile_id = auth.uid()
        AND cm2.status = 'active'
        AND cm2.role IN ('owner', 'admin')
    )
  );
