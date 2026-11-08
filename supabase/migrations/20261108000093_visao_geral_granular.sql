-- Visão geral aberta a todos; o perfil de acesso escolhe os blocos: "Sua casa hoje" e "Calendário".
-- Pode ser executada de novo sem efeito colateral.

-- Quem tinha a Visão geral continua com os dois blocos
UPDATE access_profiles
SET permissoes = (permissoes - 'visao-geral') || '["visao-geral.sua-casa", "visao-geral.calendario"]'::jsonb
WHERE permissoes ? 'visao-geral';

-- Funcionário: só o Calendário, que é pessoal; "Sua casa hoje" traz dados da empresa
UPDATE access_profiles SET permissoes = '["visao-geral.calendario"]'::jsonb WHERE padrao = 'funcionario';

CREATE OR REPLACE FUNCTION criar_perfis_acesso_padrao(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO access_profiles (company_id, nome) VALUES
    (p_company_id, 'Administrador'),
    (p_company_id, 'Funcionário')
  ON CONFLICT DO NOTHING;

  UPDATE access_profiles SET padrao = 'administrador', permissoes = '[]'::jsonb
  WHERE company_id = p_company_id AND lower(nome) = 'administrador';

  UPDATE access_profiles SET padrao = 'funcionario', permissoes = '["visao-geral.calendario"]'::jsonb
  WHERE company_id = p_company_id AND lower(nome) = lower('Funcionário');
END;
$$;

NOTIFY pgrst, 'reload schema';
