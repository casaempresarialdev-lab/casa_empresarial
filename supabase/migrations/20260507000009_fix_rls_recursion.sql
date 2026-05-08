-- ============================================================
-- FIX: Recursão infinita nas policies de company_members
--
-- Causa: a policy "company_members_select" fazia SELECT em
-- company_members dentro de si mesma. PostgreSQL detecta o
-- loop e lança 42P17.
--
-- Solução: funções SECURITY DEFINER que bypassam RLS ao
-- executar — usadas como helpers em todas as policies que
-- precisam consultar company_members.
-- ============================================================

-- Helper: IDs de empresas do usuário logado (sem RLS)
CREATE OR REPLACE FUNCTION get_my_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM company_members
  WHERE profile_id = auth.uid()
    AND status = 'active'
$$;

-- Helper: IDs de empresas onde o usuário é owner ou admin
CREATE OR REPLACE FUNCTION get_my_admin_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM company_members
  WHERE profile_id = auth.uid()
    AND status = 'active'
    AND role IN ('owner', 'admin')
$$;

-- -------------------------------------------------------
-- Recriar policies de companies usando a função helper
-- -------------------------------------------------------
DROP POLICY IF EXISTS "companies_policy"  ON companies;
DROP POLICY IF EXISTS "companies_select"  ON companies;

CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (id = ANY(ARRAY(SELECT get_my_company_ids())));

-- -------------------------------------------------------
-- Recriar policies de company_members usando as funções
-- (elimina a auto-referência recursiva)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "company_members_select" ON company_members;
DROP POLICY IF EXISTS "company_members_insert" ON company_members;
DROP POLICY IF EXISTS "company_members_update" ON company_members;

CREATE POLICY "company_members_select" ON company_members
  FOR SELECT USING (
    company_id = ANY(ARRAY(SELECT get_my_company_ids()))
  );

CREATE POLICY "company_members_insert" ON company_members
  FOR INSERT WITH CHECK (
    -- Usuário criando seu primeiro vínculo como owner
    (profile_id = auth.uid() AND role = 'owner')
    OR
    -- Owner/admin adicionando membros a empresa já existente
    company_id = ANY(ARRAY(SELECT get_my_admin_company_ids()))
  );

CREATE POLICY "company_members_update" ON company_members
  FOR UPDATE USING (
    company_id = ANY(ARRAY(SELECT get_my_admin_company_ids()))
  );

-- -------------------------------------------------------
-- Atualizar também is_company_member para usar a mesma
-- lógica (já era SECURITY DEFINER, mas alinhamos)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION is_company_member(cid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = cid
      AND profile_id = auth.uid()
      AND status = 'active'
  );
$$;
