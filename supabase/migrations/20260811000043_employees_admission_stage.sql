ALTER TABLE employees
ADD COLUMN IF NOT EXISTS admission_stage TEXT DEFAULT 'entrevista';
