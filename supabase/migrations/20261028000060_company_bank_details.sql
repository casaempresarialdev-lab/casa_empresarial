-- Dados bancários da ficha da empresa (Minha Empresa): vários bancos por empresa.
-- Cadastro informativo, separado de bank_accounts (contas do Financeiro com saldo e lançamentos).
CREATE TABLE IF NOT EXISTS company_bank_details (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  banco       text NOT NULL,
  tipo_conta  text CHECK (tipo_conta IN ('corrente', 'poupanca', 'pagamento')),
  agencia     text,
  conta       text,
  digito      text,
  pix_tipo    text CHECK (pix_tipo IN ('cnpj', 'email', 'telefone', 'aleatoria')),
  pix_chave   text,
  principal   boolean NOT NULL DEFAULT false,
  ordem       int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE company_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view their company bank details"
  ON company_bank_details FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "members can insert company bank details"
  ON company_bank_details FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "members can update company bank details"
  ON company_bank_details FOR UPDATE
  USING (is_company_member(company_id));

CREATE POLICY "members can delete company bank details"
  ON company_bank_details FOR DELETE
  USING (is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_company_bank_details_company_id ON company_bank_details(company_id);
