-- Campos de documentos do funcionário (storage paths no bucket 'documentos')
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS foto_path                       TEXT,
  ADD COLUMN IF NOT EXISTS doc_rg_cnh_frente_path          TEXT,
  ADD COLUMN IF NOT EXISTS doc_rg_verso_path               TEXT,
  ADD COLUMN IF NOT EXISTS doc_exame_admissional_path      TEXT,
  ADD COLUMN IF NOT EXISTS doc_cpf_path                    TEXT,
  ADD COLUMN IF NOT EXISTS doc_comprovante_residencia_path TEXT,
  ADD COLUMN IF NOT EXISTS doc_titulo_eleitor_path         TEXT,
  ADD COLUMN IF NOT EXISTS doc_ctps_path                   TEXT,
  ADD COLUMN IF NOT EXISTS doc_pis_path                    TEXT,
  ADD COLUMN IF NOT EXISTS doc_certidao_path               TEXT;
