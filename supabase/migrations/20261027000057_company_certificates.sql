-- Vários certificados digitais por empresa (arquivos no bucket privado 'certificados')
CREATE TABLE IF NOT EXISTS company_certificates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  identificacao text NOT NULL,
  nome_arquivo  text NOT NULL,
  storage_path  text NOT NULL,
  senha_enc     text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE company_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view their company certificates"
  ON company_certificates FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "members can insert company certificates"
  ON company_certificates FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "members can update company certificates"
  ON company_certificates FOR UPDATE
  USING (is_company_member(company_id));

CREATE POLICY "members can delete company certificates"
  ON company_certificates FOR DELETE
  USING (is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_company_certificates_company_id ON company_certificates(company_id);

-- Leva o certificado único que já existia em companies para a nova tabela
INSERT INTO company_certificates (company_id, identificacao, nome_arquivo, storage_path, senha_enc)
SELECT c.id, 'Certificado A1', split_part(c.certificado_digital_url, '/', 2), c.certificado_digital_url, c.certificado_digital_senha_enc
FROM companies c
WHERE c.certificado_digital_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM company_certificates cc WHERE cc.storage_path = c.certificado_digital_url
  );
