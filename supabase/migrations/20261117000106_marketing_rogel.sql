-- ============================================================
-- Marketing — Fase 1 do plano de padronização com o artefato novo da Carol.
-- Nenhuma tela de Marketing foi construída de verdade ainda (todas ComingSoon),
-- então os ALTERs abaixo em editorial_calendar/media_assets são seguros: zero
-- linha real gravada por essas telas até hoje. brand_manual fica pausada, sem
-- mudança (saiu do escopo — ver análise do artefato novo da Carol).
-- ============================================================

-- ------------------------------------------------------------
-- CALENDÁRIO EDITORIAL — pipeline de produção (ideia→fazendo→feito→agendado→
-- publicado), formato, fase do funil e canal, no lugar de plataforma/estratégia
-- ------------------------------------------------------------
UPDATE editorial_calendar SET status = 'fazendo' WHERE status = 'em_producao';
ALTER TABLE editorial_calendar DROP CONSTRAINT IF EXISTS editorial_calendar_status_check;
ALTER TABLE editorial_calendar ADD CONSTRAINT editorial_calendar_status_check
  CHECK (status IN ('ideia', 'fazendo', 'feito', 'agendado', 'publicado'));

ALTER TABLE editorial_calendar RENAME COLUMN descricao TO objetivo;
ALTER TABLE editorial_calendar DROP COLUMN IF EXISTS plataforma;
ALTER TABLE editorial_calendar DROP COLUMN IF EXISTS estrategia;

ALTER TABLE editorial_calendar ADD COLUMN formato TEXT
  CHECK (formato IN ('post', 'reels', 'stories', 'artigo', 'email', 'outro'));
ALTER TABLE editorial_calendar ADD COLUMN formato_outro TEXT;
ALTER TABLE editorial_calendar ADD COLUMN fase TEXT
  CHECK (fase IN ('topo', 'meio', 'fundo'));
ALTER TABLE editorial_calendar ADD COLUMN canal TEXT
  CHECK (canal IN ('instagram', 'facebook', 'linkedin', 'whatsapp', 'blog', 'email', 'outro'));
ALTER TABLE editorial_calendar ADD COLUMN canal_outro TEXT;
-- Mídias do Banco de mídia anexadas a esta publicação (FK leve, sem coluna de junção)
ALTER TABLE editorial_calendar ADD COLUMN midia_ids UUID[] NOT NULL DEFAULT '{}';

-- ------------------------------------------------------------
-- BANCO DE MÍDIA — media_assets perde o "tipo" fixo (foto/video/material_grafico/
-- depoimento) e passa a organizar por área do Método, como no artefato da Carol.
-- Depoimento ganha tabela própria embaixo (não é mídia, é texto).
-- ------------------------------------------------------------
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_tipo_check;
ALTER TABLE media_assets DROP COLUMN IF EXISTS tipo;
ALTER TABLE media_assets DROP COLUMN IF EXISTS cliente_nome;
ALTER TABLE media_assets DROP COLUMN IF EXISTS estrelas;

ALTER TABLE media_assets ADD COLUMN area TEXT NOT NULL DEFAULT 'geral'
  CHECK (area IN ('geral', 'administrativo', 'financeiro', 'pessoas', 'operacional', 'marketing'));
ALTER TABLE media_assets ADD COLUMN tema TEXT;

CREATE INDEX IF NOT EXISTS idx_media_assets_area ON media_assets (company_id, area);

-- ------------------------------------------------------------
-- DEPOIMENTOS E PROVA SOCIAL — tabela própria (cliente, fonte, texto citado,
-- destaque), separada de media_assets.
-- ------------------------------------------------------------
CREATE TABLE depoimentos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cliente     TEXT NOT NULL,
  fonte       TEXT NOT NULL DEFAULT 'outro'
              CHECK (fonte IN ('whatsapp', 'instagram', 'email', 'presencial', 'outro')),
  fonte_outro TEXT,
  data        DATE,
  texto       TEXT NOT NULL,
  destaque    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE depoimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depoimentos_policy" ON depoimentos USING (is_company_member(company_id));
CREATE TRIGGER depoimentos_updated_at BEFORE UPDATE ON depoimentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_depoimentos_company ON depoimentos (company_id, destaque);

-- ------------------------------------------------------------
-- BANCO DE IDEIAS — pauta solta antes de virar publicação no Calendário editorial
-- ------------------------------------------------------------
CREATE TABLE ideias_marketing (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  formato     TEXT CHECK (formato IN ('post', 'reels', 'stories', 'artigo', 'email', 'outro')),
  notas       TEXT,
  status      TEXT NOT NULL DEFAULT 'ideia'
              CHECK (status IN ('ideia', 'promovida', 'descartada')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ideias_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ideias_marketing_policy" ON ideias_marketing USING (is_company_member(company_id));
CREATE TRIGGER ideias_marketing_updated_at BEFORE UPDATE ON ideias_marketing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_ideias_marketing_company ON ideias_marketing (company_id, status);

-- ------------------------------------------------------------
-- CAMPANHAS E PROMOÇÕES — status (planejada/ativa/concluída) é calculado a
-- partir das datas no app, nunca gravado aqui.
-- ------------------------------------------------------------
CREATE TABLE campanhas_marketing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  objetivo        TEXT NOT NULL DEFAULT 'outro'
                  CHECK (objetivo IN ('captar', 'vendas', 'lancamento', 'fidelizar', 'data', 'outro')),
  canal           TEXT CHECK (canal IN ('instagram', 'facebook', 'linkedin', 'whatsapp', 'blog', 'email', 'outro')),
  data_inicio     DATE NOT NULL,
  data_fim        DATE,
  orcamento       NUMERIC(12,2),
  leads_gerados   INT,
  vendas_geradas  NUMERIC(12,2),
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE campanhas_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campanhas_marketing_policy" ON campanhas_marketing USING (is_company_member(company_id));
CREATE TRIGGER campanhas_marketing_updated_at BEFORE UPDATE ON campanhas_marketing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_campanhas_marketing_company ON campanhas_marketing (company_id, data_inicio);

-- ------------------------------------------------------------
-- MÉTRICAS DE REDES SOCIAIS — um registro por rede+mês (sem edição, só
-- adicionar/excluir, como no artefato da Carol)
-- ------------------------------------------------------------
CREATE TABLE metricas_redes_sociais (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rede          TEXT NOT NULL CHECK (rede IN ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'outro')),
  mes           DATE NOT NULL,
  seguidores    INT NOT NULL,
  alcance       INT,
  engajamento   NUMERIC(5,2),
  observacao    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, rede, mes)
);

ALTER TABLE metricas_redes_sociais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metricas_redes_sociais_policy" ON metricas_redes_sociais USING (is_company_member(company_id));
CREATE INDEX idx_metricas_redes_company ON metricas_redes_sociais (company_id, rede);

NOTIFY pgrst, 'reload schema';
