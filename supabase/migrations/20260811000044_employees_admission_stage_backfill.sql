-- Backfill: todos os funcionários que já saíram do fluxo de admissão
-- recebem admission_stage = 'finalizado' para aparecer na aba Ativos da Equipe.
UPDATE employees
SET admission_stage = 'finalizado'
WHERE status IN ('experiencia', 'ativo', 'ferias', 'afastado', 'inativo', 'demitido');
