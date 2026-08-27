-- Vincula um funcionario (employees) a uma conta de acesso ao sistema (profiles),
-- necessario para o novo perfil "colaborador" logar e ver os proprios dados.
ALTER TABLE employees
  ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_employees_profile_id ON employees(profile_id);
