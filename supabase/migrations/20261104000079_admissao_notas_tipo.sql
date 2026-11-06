-- Linha do tempo da ficha de admissão: separa o que alguém escreveu do que o sistema registrou sozinho
ALTER TABLE admission_notes ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'anotacao' CHECK (tipo IN ('anotacao', 'evento'));

-- Registros automáticos já gravados
UPDATE admission_notes SET tipo = 'evento'
WHERE texto IN ('Deixado em espera.', 'Retomado da espera.', 'Carta proposta enviada.', 'Aprovado na entrevista.', 'Reprovado.', 'Carta proposta recusada.', 'Dados e documentos preenchidos pelo candidato.')
   OR texto LIKE 'Reprovado. Motivo:%'
   OR texto LIKE 'Carta proposta recusada. Motivo:%'
   OR texto LIKE 'Carta proposta aceita%';

NOTIFY pgrst, 'reload schema';
