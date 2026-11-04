-- Kanban de admissão com etapas fixas, definidas no código (app/(app)/pessoas/admissao/etapas.ts).
-- A tabela company_admission_stages deixa de ser usada; fica no banco até a versão antiga sair do ar.

-- "Deixar em espera": o card continua na etapa, oculto até pedir para exibir
ALTER TABLE employees ADD COLUMN IF NOT EXISTS admissao_em_espera BOOLEAN NOT NULL DEFAULT false;

-- Quem já saiu do funil fica na etapa final (a Equipe lista quem está nela)
UPDATE employees SET admission_stage = 'finalizado' WHERE status <> 'admissao';

-- Quem está em admissão vai para a etapa equivalente; colunas personalizadas voltam para o início
UPDATE employees
SET admission_stage = CASE admission_stage
  WHEN 'finalizado' THEN 'finalizado'
  WHEN 'enviar_formulario' THEN 'enviar_carta_proposta'
  WHEN 'aguardando_preenchimento' THEN 'enviar_carta_proposta'
  WHEN 'agendar_exame' THEN 'encaminhar_exame'
  WHEN 'aguardando_contabilidade' THEN 'enviar_contabilidade'
  WHEN 'assinatura' THEN 'assinar_contrato'
  ELSE 'realizar_entrevista'
END
WHERE status = 'admissao';
