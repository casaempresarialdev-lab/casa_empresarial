-- company_benefits: catálogo de benefícios por empresa
CREATE TABLE company_benefits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  por_dia_trabalhado BOOLEAN NOT NULL DEFAULT FALSE,
  desconta_salario BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_updated_at_company_benefits
  BEFORE UPDATE ON company_benefits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE company_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_benefits_select" ON company_benefits
  FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "company_benefits_insert" ON company_benefits
  FOR INSERT WITH CHECK (is_company_member(company_id));
CREATE POLICY "company_benefits_update" ON company_benefits
  FOR UPDATE USING (is_company_member(company_id));
CREATE POLICY "company_benefits_delete" ON company_benefits
  FOR DELETE USING (is_company_member(company_id));

CREATE INDEX idx_company_benefits_company ON company_benefits (company_id) WHERE ativo = TRUE;

-- employee_benefits: benefícios atribuídos por funcionário
CREATE TABLE employee_benefits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  benefit_id UUID NOT NULL REFERENCES company_benefits(id) ON DELETE CASCADE,
  valor_override DECIMAL(10,2) NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, benefit_id)
);

ALTER TABLE employee_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_benefits_select" ON employee_benefits
  FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "employee_benefits_insert" ON employee_benefits
  FOR INSERT WITH CHECK (is_company_member(company_id));
CREATE POLICY "employee_benefits_update" ON employee_benefits
  FOR UPDATE USING (is_company_member(company_id));
CREATE POLICY "employee_benefits_delete" ON employee_benefits
  FOR DELETE USING (is_company_member(company_id));

CREATE INDEX idx_employee_benefits_employee ON employee_benefits (employee_id);
CREATE INDEX idx_employee_benefits_benefit  ON employee_benefits (benefit_id);
