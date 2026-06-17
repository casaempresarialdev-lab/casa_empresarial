-- Prestadores: data de início do contrato.
-- A coluna `documentos JSONB` já existe (migration 20260507000005) e passa a
-- armazenar um array com até 3 arquivos: { nome, storage_path, tipo, size, label }.
ALTER TABLE service_providers
  ADD COLUMN IF NOT EXISTS data_inicio DATE;
