-- Códigos de verificação enviados por e-mail (ex.: confirmar identidade antes de ativar o 2FA).
-- Guardados só como hash, com validade curta e limite de tentativas. Acesso apenas pelo servidor (sem políticas de RLS).
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  finalidade    text NOT NULL,
  code_hash     text NOT NULL,
  expira_em     timestamptz NOT NULL,
  tentativas    int NOT NULL DEFAULT 0,
  verificado_em timestamptz,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_email_verification_codes_profile ON email_verification_codes (profile_id, finalidade);
