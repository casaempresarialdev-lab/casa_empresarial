-- ============================================================
-- SPRINT 1 — Fundação: Auth + Multi-tenant
-- ============================================================

-- ------------------------------------------------------------
-- FUNÇÕES UTILITÁRIAS (criadas antes para uso nos triggers)
-- ------------------------------------------------------------

-- Trigger helper: atualiza updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger: cria profile automaticamente ao cadastrar novo usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- TABELAS (todas primeiro, sem policies — evita dependência circular)
-- ------------------------------------------------------------

-- PROFILES
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- COMPANIES
CREATE TABLE companies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social          TEXT NOT NULL,
  nome_fantasia         TEXT,
  cnpj                  TEXT UNIQUE NOT NULL,
  inscricao_estadual    TEXT,
  inscricao_municipal   TEXT,
  regime_tributario     TEXT CHECK (regime_tributario IN ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei')),
  endereco              JSONB DEFAULT '{}',
  telefone              TEXT,
  email                 TEXT,
  logo_url              TEXT,
  instagram_url         TEXT,
  cor_principal         TEXT DEFAULT '#C19A6B',
  cor_secundaria        TEXT DEFAULT '#EED9C4',
  dados_bancarios       JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- COMPANY_MEMBERS (referencia companies e profiles — criada depois dos dois)
CREATE TABLE company_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'admin', 'member', 'accountant')),
  permissions JSONB DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive', 'pending')),
  invited_by  UUID REFERENCES profiles(id),
  invited_at  TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, profile_id)
);

-- ------------------------------------------------------------
-- TRIGGERS
-- ------------------------------------------------------------

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- RLS — habilitado depois de todas as tabelas existirem
-- ------------------------------------------------------------

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- Policies de profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policies de companies
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM company_members
      WHERE profile_id = auth.uid()
      AND status = 'active'
    )
  );

-- Qualquer usuário autenticado pode criar sua primeira empresa
CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policies de company_members
CREATE POLICY "company_members_select" ON company_members
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members cm2
      WHERE cm2.profile_id = auth.uid()
      AND cm2.status = 'active'
    )
  );

CREATE POLICY "company_members_insert" ON company_members
  FOR INSERT WITH CHECK (
    -- Usuário vinculando a si mesmo como owner de uma nova empresa
    (profile_id = auth.uid() AND role = 'owner')
    OR
    -- Owner/admin adicionando terceiros a uma empresa existente
    company_id IN (
      SELECT company_id FROM company_members cm2
      WHERE cm2.profile_id = auth.uid()
        AND cm2.status = 'active'
        AND cm2.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "company_members_update" ON company_members
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM company_members cm2
      WHERE cm2.profile_id = auth.uid()
      AND cm2.status = 'active'
      AND cm2.role IN ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------

CREATE INDEX idx_company_members_profile ON company_members (profile_id);
CREATE INDEX idx_company_members_company ON company_members (company_id);
CREATE INDEX idx_company_members_status  ON company_members (status);
CREATE INDEX idx_companies_cnpj          ON companies (cnpj);
