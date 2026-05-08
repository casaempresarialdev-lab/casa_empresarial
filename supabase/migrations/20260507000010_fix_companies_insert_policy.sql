-- ============================================================
-- FIX: Policy de INSERT na tabela companies
--
-- Causa: migration 000008 tentou CREATE sem DROP IF EXISTS,
-- causando erro de "policy already exists" e rollback.
-- Estado atual do banco pode ter a policy ausente ou incorreta.
--
-- Solução: DROP IF EXISTS + CREATE garantido.
-- ============================================================

DROP POLICY IF EXISTS "companies_insert" ON companies;

CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Garantir também que a policy de UPDATE exista para owners/admins
DROP POLICY IF EXISTS "companies_update" ON companies;

CREATE POLICY "companies_update" ON companies
  FOR UPDATE USING (
    id = ANY(ARRAY(SELECT get_my_admin_company_ids()))
  );
