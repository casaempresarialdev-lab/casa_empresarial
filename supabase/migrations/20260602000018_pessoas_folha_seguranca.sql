-- ============================================================
-- Módulo Pessoas — Folha de Pagamento + Segurança e Saúde
-- ============================================================

-- ------------------------------------------------------------
-- PAYROLL_ENTRIES (Folha de Pagamento mensal por funcionário)
-- ------------------------------------------------------------
CREATE TABLE payroll_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  mes_ano             TEXT NOT NULL,             -- formato: '2026-06'
  salario_base        DECIMAL(10,2) NOT NULL DEFAULT 0,
  horas_extras        DECIMAL(10,2) NOT NULL DEFAULT 0,
  adicional_noturno   DECIMAL(10,2) NOT NULL DEFAULT 0,
  bonus               DECIMAL(10,2) NOT NULL DEFAULT 0,
  desconto_faltas     DECIMAL(10,2) NOT NULL DEFAULT 0,
  desconto_inss       DECIMAL(10,2) NOT NULL DEFAULT 0,
  desconto_irrf       DECIMAL(10,2) NOT NULL DEFAULT 0,
  desconto_vt         DECIMAL(10,2) NOT NULL DEFAULT 0,
  desconto_outros     DECIMAL(10,2) NOT NULL DEFAULT 0,
  salario_liquido     DECIMAL(10,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho', 'fechado', 'pago')),
  observacao          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, mes_ano)
);

ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_entries_select_policy" ON payroll_entries
  FOR SELECT USING (is_company_member(company_id));

CREATE POLICY "payroll_entries_insert_policy" ON payroll_entries
  FOR INSERT WITH CHECK (is_company_member(company_id));

CREATE POLICY "payroll_entries_update_policy" ON payroll_entries
  FOR UPDATE USING (is_company_member(company_id));

CREATE POLICY "payroll_entries_delete_policy" ON payroll_entries
  FOR DELETE USING (is_company_member(company_id));

CREATE TRIGGER payroll_entries_updated_at
  BEFORE UPDATE ON payroll_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payroll_entries_company  ON payroll_entries (company_id);
CREATE INDEX idx_payroll_entries_employee ON payroll_entries (employee_id);
CREATE INDEX idx_payroll_entries_mes_ano  ON payroll_entries (mes_ano);

-- ------------------------------------------------------------
-- HEALTH_SAFETY_RECORDS (Segurança e Saúde Ocupacional)
-- ------------------------------------------------------------
CREATE TABLE health_safety_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id      UUID REFERENCES employees(id) ON DELETE SET NULL,
  tipo             TEXT NOT NULL
                   CHECK (tipo IN ('aso', 'treinamento', 'epi', 'incidente', 'vacina')),
  titulo           TEXT NOT NULL,
  data             DATE,
  data_vencimento  DATE,
  resultado        TEXT,   -- para ASO: 'apto' | 'inapto' | 'apto_com_restricoes'
  observacao       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE health_safety_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_safety_select_policy" ON health_safety_records
  FOR SELECT USING (is_company_member(company_id));

CREATE POLICY "health_safety_insert_policy" ON health_safety_records
  FOR INSERT WITH CHECK (is_company_member(company_id));

CREATE POLICY "health_safety_update_policy" ON health_safety_records
  FOR UPDATE USING (is_company_member(company_id));

CREATE POLICY "health_safety_delete_policy" ON health_safety_records
  FOR DELETE USING (is_company_member(company_id));

CREATE TRIGGER health_safety_updated_at
  BEFORE UPDATE ON health_safety_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_health_safety_company  ON health_safety_records (company_id);
CREATE INDEX idx_health_safety_employee ON health_safety_records (employee_id);
CREATE INDEX idx_health_safety_tipo     ON health_safety_records (tipo);
