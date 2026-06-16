-- ============================================================
-- Sprint 10 — Expansão da tabela employees
-- Campos para controle de funcionários conforme planilha Carol
-- ============================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS local_trabalho        TEXT,
  ADD COLUMN IF NOT EXISTS tem_periculosidade    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dias_trabalhados_vt   INTEGER NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS fim_experiencia_1     DATE,
  ADD COLUMN IF NOT EXISTS fim_experiencia_2     DATE,
  ADD COLUMN IF NOT EXISTS vcto_ferias           DATE,
  ADD COLUMN IF NOT EXISTS conceder_ferias_ate   DATE,
  ADD COLUMN IF NOT EXISTS exame_periodico       DATE,
  ADD COLUMN IF NOT EXISTS status_contrato       TEXT
                             CHECK (status_contrato IN ('assinado', 'nao_tem', 'nao_assinado')),
  ADD COLUMN IF NOT EXISTS pis_pasep             TEXT,
  ADD COLUMN IF NOT EXISTS matricula             TEXT,
  ADD COLUMN IF NOT EXISTS dados_bancarios       TEXT,
  ADD COLUMN IF NOT EXISTS nascimento            DATE,
  ADD COLUMN IF NOT EXISTS vale_alimentacao_valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vale_transporte_valor  DECIMAL(10,2) NOT NULL DEFAULT 0;
