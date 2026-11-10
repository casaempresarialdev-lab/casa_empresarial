-- Notificações entre colaborador e área de Pessoas: pedidos de ajuste de ponto, atestados e ausências, férias.
-- Pode ser executada de novo sem efeito colateral.

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Quem recebe
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('ponto', 'ausencia', 'ferias', 'folha', 'saude')),
  titulo      TEXT NOT NULL,
  mensagem    TEXT NOT NULL,
  link        TEXT,
  visto_em    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_destinatario ON notifications (profile_id, company_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_policy" ON notifications;
CREATE POLICY "notifications_policy" ON notifications USING (profile_id = auth.uid());

NOTIFY pgrst, 'reload schema';
