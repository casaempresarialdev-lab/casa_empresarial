-- Adicionar campos de almoço ao time_records e recalcular horas_trabalhadas

ALTER TABLE time_records
  ADD COLUMN IF NOT EXISTS saida_almoco   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retorno_almoco TIMESTAMPTZ;

-- Recriar horas_trabalhadas descontando a pausa de almoço quando registrada
ALTER TABLE time_records DROP COLUMN IF EXISTS horas_trabalhadas;

ALTER TABLE time_records
  ADD COLUMN horas_trabalhadas INTERVAL GENERATED ALWAYS AS (
    CASE
      WHEN entrada IS NOT NULL AND saida_almoco IS NOT NULL
           AND retorno_almoco IS NOT NULL AND saida IS NOT NULL
        THEN (saida_almoco - entrada) + (saida - retorno_almoco)
      WHEN entrada IS NOT NULL AND saida IS NOT NULL
        THEN saida - entrada
      ELSE NULL
    END
  ) STORED;
