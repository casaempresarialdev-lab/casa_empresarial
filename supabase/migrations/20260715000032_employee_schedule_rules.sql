-- Tabela de regras de escala recorrente por funcionário (geração virtual)
CREATE TABLE employee_schedule_rules (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id           UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id          UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data_inicio          DATE        NOT NULL,
  data_fim             DATE,
  hora_entrada         TIME        NOT NULL,
  hora_saida           TIME        NOT NULL,
  hora_almoco_inicio   TIME,
  hora_almoco_fim      TIME,
  -- 'semanal': usa dias_folga (array de dias da semana de folga, 0=Dom..6=Sáb)
  -- '12x36':   usa data_referencia (primeiro dia de trabalho do ciclo)
  tipo_escala          TEXT        NOT NULL DEFAULT 'semanal'
                       CHECK (tipo_escala IN ('semanal', '12x36')),
  dias_folga           INTEGER[]   NOT NULL DEFAULT '{}',
  data_referencia      DATE,
  -- Padrões de folga adicionais: quinzenal, a cada N dias/semanas/meses
  -- Cada item: { tipo, dia?, intervalo?, data_ref }
  folga_patterns       JSONB       NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employee_schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members select schedule rules"
  ON employee_schedule_rules FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "members insert schedule rules"
  ON employee_schedule_rules FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "members update schedule rules"
  ON employee_schedule_rules FOR UPDATE
  USING (is_company_member(company_id));

CREATE POLICY "members delete schedule rules"
  ON employee_schedule_rules FOR DELETE
  USING (is_company_member(company_id));

CREATE TRIGGER set_employee_schedule_rules_updated_at
  BEFORE UPDATE ON employee_schedule_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_esr_company  ON employee_schedule_rules(company_id);
CREATE INDEX idx_esr_employee ON employee_schedule_rules(employee_id);
