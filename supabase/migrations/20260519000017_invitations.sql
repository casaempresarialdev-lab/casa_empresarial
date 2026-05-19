CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member',
  status      text NOT NULL DEFAULT 'pending', -- pending | accepted | cancelled
  invited_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- Impede duplicata de convite pendente para o mesmo e-mail na mesma empresa
CREATE UNIQUE INDEX idx_invitations_company_email_pending
  ON invitations(company_id, email)
  WHERE status = 'pending';

CREATE INDEX idx_invitations_company_id ON invitations(company_id);
CREATE INDEX idx_invitations_email      ON invitations(email);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view company invitations"
  ON invitations FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "members can insert invitations"
  ON invitations FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "members can update invitations"
  ON invitations FOR UPDATE
  USING (is_company_member(company_id));
