-- Add new employee fields: CTPS series, reservist certificate, dependents count
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS serie_ctps              TEXT,
  ADD COLUMN IF NOT EXISTS certificado_reservista  TEXT,
  ADD COLUMN IF NOT EXISTS dependentes             INTEGER NOT NULL DEFAULT 0;
