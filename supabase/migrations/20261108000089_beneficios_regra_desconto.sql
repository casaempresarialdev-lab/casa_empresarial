-- Benefício: o que a empresa oferece (valor) e, à parte, a regra do que é descontado do colaborador.
-- desconta_salario continua sendo gravado para a versão publicada seguir funcionando; sai depois do deploy.

ALTER TABLE company_benefits ADD COLUMN IF NOT EXISTS desconto_tipo TEXT NOT NULL DEFAULT 'nenhum'
  CHECK (desconto_tipo IN ('nenhum', 'percentual_salario', 'percentual_beneficio', 'valor_fixo'));
ALTER TABLE company_benefits ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Quem descontava, descontava o valor inteiro
UPDATE company_benefits SET desconto_tipo = 'percentual_beneficio', desconto_valor = 100 WHERE desconta_salario;

-- Vale-transporte: a tela da folha já descontava 6% do salário, reconhecendo pelo nome
UPDATE company_benefits SET desconto_tipo = 'percentual_salario', desconto_valor = 6, desconta_salario = true
WHERE nome ~* '(transp|\mvt\M)';

NOTIFY pgrst, 'reload schema';
