-- ============================================================
-- SPRINT 2 — Módulo Administrativo
-- ============================================================

-- Macro RLS reutilizável (função helper)
CREATE OR REPLACE FUNCTION is_company_member(cid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = cid
    AND profile_id = auth.uid()
    AND status = 'active'
  );
$$;

-- ------------------------------------------------------------
-- SOCIOS (Quadro Societário)
-- ------------------------------------------------------------
CREATE TABLE socios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cpf           TEXT,
  email         TEXT,
  telefone      TEXT,
  participacao  DECIMAL(5,2) CHECK (participacao >= 0 AND participacao <= 100),
  cargo         TEXT,
  contato       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE socios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "socios_policy" ON socios
  USING (is_company_member(company_id));

CREATE TRIGGER socios_updated_at
  BEFORE UPDATE ON socios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_socios_company ON socios (company_id);

-- ------------------------------------------------------------
-- CREDENTIALS (Cofre de Logins e Senhas)
-- Senhas são criptografadas via pgcrypto antes de salvar
-- A criptografia/descriptografia é feita na camada de aplicação
-- usando a SUPABASE_SERVICE_ROLE_KEY como chave simétrica AES
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE credentials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sistema     TEXT NOT NULL,
  login       TEXT NOT NULL,
  -- senha salva criptografada: pgp_sym_encrypt(senha, chave) na aplicação
  senha_enc   TEXT NOT NULL,
  url         TEXT,
  observacao  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credentials_policy" ON credentials
  USING (is_company_member(company_id));

CREATE TRIGGER credentials_updated_at
  BEFORE UPDATE ON credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_credentials_company ON credentials (company_id);
