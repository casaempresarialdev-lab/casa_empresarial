-- Lembretes pessoais do usuário (não pertencem à empresa).
-- Notificação opcional: no sistema (sino da barra de ferramentas / notificação do navegador) e, se marcado, por e-mail.
CREATE TABLE IF NOT EXISTS reminders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo              text NOT NULL,
  descricao           text,
  data_hora           timestamptz NOT NULL,
  notificar           boolean NOT NULL DEFAULT false,
  -- Minutos de antecedência do aviso (0 = no horário)
  antecedencia_min    int NOT NULL DEFAULT 0 CHECK (antecedencia_min >= 0),
  notificar_email     boolean NOT NULL DEFAULT false,
  email_enviado_em    timestamptz,
  concluido           boolean NOT NULL DEFAULT false,
  concluido_em        timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_owner_policy" ON reminders
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reminders_profile_data ON reminders (profile_id, data_hora);
-- Rotina de e-mail: lembretes com aviso por e-mail ainda não enviado
CREATE INDEX IF NOT EXISTS idx_reminders_email_pendente ON reminders (data_hora)
  WHERE notificar AND notificar_email AND email_enviado_em IS NULL AND NOT concluido;

DROP TRIGGER IF EXISTS reminders_updated_at ON reminders;
CREATE TRIGGER reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
