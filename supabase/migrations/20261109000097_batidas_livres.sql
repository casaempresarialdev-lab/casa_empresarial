-- Batidas livres: o dia passa a ter uma lista de horários (entrada, saída, entrada, saída...), sem limite.
-- As colunas antigas (entrada, saida_almoco, retorno_almoco, saida) ficam guardadas, mas deixam de ser usadas.
-- Pode ser executada de novo sem efeito colateral: só copia o que ainda não foi copiado.

ALTER TABLE time_records ADD COLUMN IF NOT EXISTS batidas JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE time_adjustments ADD COLUMN IF NOT EXISTS batidas JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE time_records
SET batidas = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('em', b.em, 'origem', b.origem) ORDER BY b.em), '[]'::jsonb)
  FROM (VALUES
    (entrada,        localizacao->'entrada'),
    (saida_almoco,   localizacao->'saida_almoco'),
    (retorno_almoco, localizacao->'retorno_almoco'),
    (saida,          localizacao->'saida')
  ) AS b(em, origem)
  WHERE b.em IS NOT NULL
)
WHERE batidas = '[]'::jsonb
  AND COALESCE(entrada, saida_almoco, retorno_almoco, saida) IS NOT NULL;

UPDATE time_adjustments
SET batidas = (
  SELECT COALESCE(jsonb_agg(b.em ORDER BY b.em), '[]'::jsonb)
  FROM (VALUES (entrada), (saida_almoco), (retorno_almoco), (saida)) AS b(em)
  WHERE b.em IS NOT NULL
)
WHERE batidas = '[]'::jsonb
  AND COALESCE(entrada, saida_almoco, retorno_almoco, saida) IS NOT NULL;

NOTIFY pgrst, 'reload schema';
