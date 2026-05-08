-- ============================================================
-- SPRINT 6 — Módulo Marketing
-- ============================================================

-- ------------------------------------------------------------
-- BRAND_MANUAL (Manual da Marca)
-- Uma linha por categoria — upsert ao editar
-- ------------------------------------------------------------
CREATE TABLE brand_manual (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  categoria   TEXT NOT NULL
              CHECK (categoria IN ('conceito', 'publico-alvo', 'persona', 'tom-de-voz', 'atendimento', 'valores', 'missao', 'visao')),
  conteudo    JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, categoria)
);

ALTER TABLE brand_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_manual_policy" ON brand_manual
  USING (is_company_member(company_id));

CREATE TRIGGER brand_manual_updated_at
  BEFORE UPDATE ON brand_manual
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_brand_manual_company ON brand_manual (company_id);

-- ------------------------------------------------------------
-- EDITORIAL_CALENDAR (Calendário Editorial)
-- ------------------------------------------------------------
CREATE TABLE editorial_calendar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  titulo           TEXT NOT NULL,
  descricao        TEXT,
  data_publicacao  DATE,
  status           TEXT NOT NULL DEFAULT 'ideia'
                   CHECK (status IN ('ideia', 'em_producao', 'feito', 'publicado')),
  plataforma       TEXT,  -- 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | outro
  estrategia       TEXT,
  responsavel_id   UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE editorial_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editorial_calendar_policy" ON editorial_calendar
  USING (is_company_member(company_id));

CREATE TRIGGER editorial_calendar_updated_at
  BEFORE UPDATE ON editorial_calendar
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_editorial_company       ON editorial_calendar (company_id);
CREATE INDEX idx_editorial_data          ON editorial_calendar (data_publicacao);
CREATE INDEX idx_editorial_status        ON editorial_calendar (status);

-- ------------------------------------------------------------
-- MEDIA_ASSETS (Fotos, Vídeos, Material Gráfico, Depoimentos)
-- URLs apontam para Supabase Storage: bucket media-assets/{company_id}/
-- ------------------------------------------------------------
CREATE TABLE media_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL
              CHECK (tipo IN ('foto', 'video', 'material_grafico', 'depoimento')),
  nome        TEXT,
  descricao   TEXT,
  url         TEXT NOT NULL,
  thumbnail_url TEXT,
  tamanho     BIGINT,  -- bytes
  mime_type   TEXT,
  duracao_seg INT,     -- para vídeos
  -- para depoimentos
  cliente_nome TEXT,
  estrelas     INT CHECK (estrelas BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_policy" ON media_assets
  USING (is_company_member(company_id));

CREATE INDEX idx_media_assets_company ON media_assets (company_id);
CREATE INDEX idx_media_assets_tipo    ON media_assets (tipo);
