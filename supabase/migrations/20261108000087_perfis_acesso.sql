-- Perfis de acesso por empresa: um nome e os itens liberados (chaves de lib/acesso/catalogo.ts).
-- Substituem as funções Administrador, Membro e Contador. Proprietário (acesso total) e Colaborador
-- (só os próprios dados) continuam definidos em company_members.role, sem perfil.

CREATE TABLE access_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  permissoes  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_access_profiles_nome ON access_profiles (company_id, lower(nome));

ALTER TABLE access_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "access_profiles_policy" ON access_profiles USING (is_company_member(company_id));

-- Perfil em uso não pode ser excluído
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS access_profile_id UUID REFERENCES access_profiles(id) ON DELETE RESTRICT;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS access_profile_id UUID REFERENCES access_profiles(id) ON DELETE SET NULL;

-- Perfis prontos de cada empresa. Hoje essas funções acessam tudo, e o acesso continua igual,
-- exceto a gestão de Acesso, que nasce só no Administrador.
CREATE OR REPLACE FUNCTION criar_perfis_acesso_padrao(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todas TEXT[] := ARRAY[
    'visao-geral',
    'admin.dashboard', 'admin.quadro-societario', 'admin.documentacao', 'admin.certificado-digital',
    'financeiro.contatos', 'financeiro.centro-de-custo', 'financeiro.categorias', 'financeiro.contas-cartoes',
    'financeiro.fluxo-de-caixa', 'financeiro.dre', 'financeiro.balanco', 'financeiro.faturas',
    'pessoas.funcionarios', 'pessoas.vagas', 'pessoas.admissao', 'pessoas.rescisao', 'pessoas.registro-de-ponto',
    'pessoas.escala-de-trabalho', 'pessoas.folha-de-pagamento', 'pessoas.beneficios', 'pessoas.encargos',
    'pessoas.reunioes', 'pessoas.pesquisas', 'pessoas.seguranca-saude',
    'operacional.produtos', 'operacional.pedidos-compra', 'operacional.pedidos-venda',
    'operacional.ordens-de-servico', 'operacional.frente-de-caixa',
    'marketing.calendario', 'marketing.depoimentos', 'marketing.fotos-videos', 'marketing.material-grafico', 'marketing.manual-da-marca',
    'sistema.empresa', 'sistema.acesso', 'sistema.meu-plano', 'sistema.configuracoes'
  ];
BEGIN
  INSERT INTO access_profiles (company_id, nome, permissoes) VALUES
    (p_company_id, 'Administrador', to_jsonb(v_todas)),
    (p_company_id, 'Membro',        to_jsonb(array_remove(v_todas, 'sistema.acesso'))),
    (p_company_id, 'Contador',      to_jsonb(array_remove(v_todas, 'sistema.acesso')))
  ON CONFLICT DO NOTHING;
END;
$$;

-- Empresas que já existem
SELECT criar_perfis_acesso_padrao(id) FROM companies;

-- Empresas novas
CREATE OR REPLACE FUNCTION trg_companies_perfis_acesso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM criar_perfis_acesso_padrao(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_perfis_acesso AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION trg_companies_perfis_acesso();

-- Usuários e convites pendentes passam para o perfil equivalente à função
UPDATE company_members cm
SET access_profile_id = ap.id
FROM access_profiles ap
WHERE ap.company_id = cm.company_id
  AND ap.nome = CASE cm.role WHEN 'admin' THEN 'Administrador' WHEN 'member' THEN 'Membro' WHEN 'accountant' THEN 'Contador' END;

UPDATE invitations i
SET access_profile_id = ap.id
FROM access_profiles ap
WHERE i.status = 'pending'
  AND ap.company_id = i.company_id
  AND ap.nome = CASE i.role WHEN 'admin' THEN 'Administrador' WHEN 'member' THEN 'Membro' WHEN 'accountant' THEN 'Contador' END;

NOTIFY pgrst, 'reload schema';
