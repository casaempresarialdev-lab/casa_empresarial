-- Adiciona o role 'colaborador' — funcionario com acesso restrito (Registro de Ponto,
-- Escala de Trabalho, Folha de Pagamento, Beneficios e os proprios dados), sem acesso
-- aos demais modulos administrativos.
ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_role_check;
ALTER TABLE company_members ADD CONSTRAINT company_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'accountant', 'colaborador'));
