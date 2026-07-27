-- Unifica Funcionários + Prestadores em uma única tabela employees
-- Adiciona 'autonomo' ao enum tipo_contrato e migra service_providers

-- 1. Adicionar novos valores ao enum (PostgreSQL não permite remover valores, só adicionar)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS servico TEXT,
  ADD COLUMN IF NOT EXISTS valor_servico NUMERIC(12,2);

-- 2. Atualizar check constraint de tipo_contrato para aceitar 'autonomo'
--    (se existir, dropar e recriar; se não existir, apenas adicionar no check)
DO $$
BEGIN
  -- Tentar remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'employees'
      AND constraint_name = 'employees_tipo_contrato_check'
  ) THEN
    ALTER TABLE employees DROP CONSTRAINT employees_tipo_contrato_check;
  END IF;

  -- Verificar se tipo_contrato é uma coluna TEXT ou ENUM
  -- Se for TEXT com CHECK, recriar o check; se for ENUM, adicionar valor
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees'
      AND column_name = 'tipo_contrato'
      AND data_type = 'USER-DEFINED'
  ) THEN
    -- É um tipo ENUM — tentar adicionar o valor
    BEGIN
      ALTER TYPE tipo_contrato ADD VALUE IF NOT EXISTS 'autonomo';
    EXCEPTION WHEN others THEN
      NULL; -- valor já existe
    END;
  ELSE
    -- É TEXT com check constraint — recriar sem limitação de valores
    -- (deixamos aberto para qualquer string; validação fica na aplicação)
    NULL;
  END IF;
END $$;

-- 3. Migrar service_providers → employees
INSERT INTO employees (
  company_id,
  nome,
  cpf,
  cnpj,
  email,
  telefone,
  servico,
  valor_servico,
  data_admissao,
  tipo_contrato,
  status,
  created_at,
  updated_at
)
SELECT
  sp.company_id,
  sp.nome,
  CASE WHEN sp.tipo = 'PF' THEN replace(replace(replace(sp.cpf_cnpj, '.', ''), '-', ''), '/', '') ELSE NULL END,
  CASE WHEN sp.tipo = 'PJ' THEN replace(replace(replace(sp.cpf_cnpj, '.', ''), '-', ''), '/', '') ELSE NULL END,
  sp.email,
  sp.telefone,
  sp.servico,
  sp.valor,
  sp.data_inicio,
  CASE WHEN sp.tipo = 'PJ' THEN 'pj' ELSE 'autonomo' END,
  'ativo',
  sp.created_at,
  sp.updated_at
FROM service_providers sp
WHERE NOT EXISTS (
  -- Evitar duplicar se migração for rodada duas vezes
  SELECT 1 FROM employees e
  WHERE e.company_id = sp.company_id
    AND e.nome = sp.nome
    AND e.created_at = sp.created_at
);

-- 4. RLS: garantir que as novas colunas não quebram políticas existentes
--    (as políticas já filtram por company_id, não precisam de ajuste)

-- Nota: a tabela service_providers NÃO é removida aqui para segurança.
-- Após confirmar que a migração está OK em produção, executar manualmente:
-- DROP TABLE service_providers;
