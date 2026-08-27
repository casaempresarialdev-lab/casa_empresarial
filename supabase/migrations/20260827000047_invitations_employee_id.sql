-- Guarda a qual funcionario um convite de acesso "colaborador" se refere, para que
-- employees.profile_id seja vinculado automaticamente quando o convite for aceito.
ALTER TABLE invitations
  ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
