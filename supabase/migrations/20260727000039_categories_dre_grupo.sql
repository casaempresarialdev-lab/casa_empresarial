-- Adiciona classificação DRE às categorias
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS dre_grupo TEXT NOT NULL DEFAULT 'nao_classificado'
    CHECK (dre_grupo IN (
      'receita_operacional',
      'deducao_receita',
      'cmv_cpv',
      'despesa_pessoal',
      'despesa_administrativa',
      'despesa_comercial',
      'outras_receitas',
      'receita_financeira',
      'despesa_financeira',
      'imposto',
      'nao_classificado'
    ));

-- Melhor guess inicial: receitas → receita_operacional, despesas → despesa_administrativa
UPDATE categories SET dre_grupo = 'receita_operacional'  WHERE tipo = 'receita'  AND dre_grupo = 'nao_classificado';
UPDATE categories SET dre_grupo = 'despesa_administrativa' WHERE tipo = 'despesa' AND dre_grupo = 'nao_classificado';
