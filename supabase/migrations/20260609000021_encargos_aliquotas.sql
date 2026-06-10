-- company_encargos_aliquotas: alíquotas de encargos patronais configuráveis por empresa
CREATE TABLE company_encargos_aliquotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  percentual DECIMAL(5,2) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_updated_at_company_encargos_aliquotas
  BEFORE UPDATE ON company_encargos_aliquotas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE company_encargos_aliquotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encargos_aliquotas_select" ON company_encargos_aliquotas
  FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "encargos_aliquotas_insert" ON company_encargos_aliquotas
  FOR INSERT WITH CHECK (is_company_member(company_id));
CREATE POLICY "encargos_aliquotas_update" ON company_encargos_aliquotas
  FOR UPDATE USING (is_company_member(company_id));
CREATE POLICY "encargos_aliquotas_delete" ON company_encargos_aliquotas
  FOR DELETE USING (is_company_member(company_id));

CREATE INDEX idx_encargos_aliquotas_company ON company_encargos_aliquotas (company_id, ordem);
