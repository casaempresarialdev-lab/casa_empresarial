-- ============================================================
-- Chamados de suporte — registrados direto no sistema (sem abrir WhatsApp
-- nem e-mail), via o botão flutuante da mascote "Cá". Não é assistente de
-- IA: só grava a mensagem pra alguém da equipe consultar depois.
-- ============================================================

CREATE TABLE support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES profiles(id),
  mensagem    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'respondido', 'fechado')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_select" ON support_tickets
  FOR SELECT USING (is_company_member(company_id));

CREATE POLICY "support_tickets_insert" ON support_tickets
  FOR INSERT WITH CHECK (is_company_member(company_id));

CREATE INDEX idx_support_tickets_company ON support_tickets (company_id, created_at DESC);
