-- Calendário: duração, local (presencial/online), recorrência, convidados e agendas compartilhadas.

-- ── Eventos ──────────────────────────────────────────────────────────────────
-- Duração em minutos (término = data_hora + duração)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS duracao_min int NOT NULL DEFAULT 60 CHECK (duracao_min > 0 AND duracao_min <= 1440);
-- Onde acontece: presencial (local) ou online (link da reunião); nulo = sem local
-- (modalidade foi removida na 072: local e link podem coexistir — reunião híbrida)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS modalidade text CHECK (modalidade IN ('presencial', 'online'));
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS local text;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS link_reuniao text;
-- Recorrência: cada ocorrência é uma linha; todas da mesma série compartilham serie_id
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS serie_id uuid;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recorrencia text CHECK (recorrencia IN ('diaria', 'semanal', 'mensal'));
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recorrencia_ate date;

CREATE INDEX IF NOT EXISTS idx_reminders_serie ON reminders (serie_id, data_hora) WHERE serie_id IS NOT NULL;

-- ── Convidados ───────────────────────────────────────────────────────────────
-- Usuários convidados para um evento: veem o evento no calendário e respondem (aceito/recusado)
CREATE TABLE IF NOT EXISTS reminder_participants (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id        uuid NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  profile_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email              text NOT NULL,
  status             text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado')),
  respondido_em      timestamptz,
  -- Notificação do convite vista no sino
  aviso_visto_em     timestamptz,
  -- Aviso do horário do evento visto no sino (para quem não recusou)
  lembrete_visto_em  timestamptz,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (reminder_id, profile_id)
);

ALTER TABLE reminder_participants ENABLE ROW LEVEL SECURITY;

-- Convidado vê e responde o próprio convite; dono do evento gerencia os convidados
CREATE POLICY "reminder_participants_convidado" ON reminder_participants
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "reminder_participants_dono" ON reminder_participants
  USING (EXISTS (SELECT 1 FROM reminders r WHERE r.id = reminder_id AND r.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM reminders r WHERE r.id = reminder_id AND r.profile_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_reminder_participants_profile ON reminder_participants (profile_id);
CREATE INDEX IF NOT EXISTS idx_reminder_participants_reminder ON reminder_participants (reminder_id);

-- ── Agendas compartilhadas ───────────────────────────────────────────────────
-- O dono compartilha a própria agenda; quem recebe acompanha (só visualização)
CREATE TABLE IF NOT EXISTS calendar_shares (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with_email text NOT NULL,
  aviso_visto_em  timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (owner_id, shared_with),
  CHECK (owner_id <> shared_with)
);

ALTER TABLE calendar_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_shares_dono" ON calendar_shares
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
-- Quem recebe pode ver e deixar de acompanhar (excluir)
CREATE POLICY "calendar_shares_recebido_select" ON calendar_shares FOR SELECT USING (shared_with = auth.uid());
CREATE POLICY "calendar_shares_recebido_delete" ON calendar_shares FOR DELETE USING (shared_with = auth.uid());

CREATE INDEX IF NOT EXISTS idx_calendar_shares_shared_with ON calendar_shares (shared_with);
