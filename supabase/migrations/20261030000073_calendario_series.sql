-- Repetição sem data final e por dias da semana (estilo Google Agenda).
-- Cada ocorrência continua sendo uma linha em reminders (aviso, concluído e convidados próprios);
-- reminder_series guarda a regra e até onde as ocorrências já foram geradas, para o sistema ir
-- criando as próximas (até 12 meses à frente) ao abrir o calendário e na rotina diária.

-- Dias da semana da repetição semanal (0 = domingo … 6 = sábado)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS dias_semana smallint[];

CREATE TABLE IF NOT EXISTS reminder_series (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recorrencia  text NOT NULL CHECK (recorrencia IN ('diaria', 'semanal', 'mensal')),
  dias_semana  smallint[],
  -- Primeira ocorrência: base do horário e do dia do mês das próximas
  inicio       timestamptz NOT NULL,
  -- Último dia da repetição; nulo = sem data final
  ate          date,
  -- Até quando as ocorrências já foram criadas (as próximas são geradas depois deste momento)
  gerado_ate   timestamptz NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE reminder_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminder_series_owner_policy" ON reminder_series
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Rotina que estende as séries: as que ainda não chegaram ao horizonte
CREATE INDEX IF NOT EXISTS idx_reminder_series_gerado ON reminder_series (gerado_ate);

-- Séries criadas antes desta migration (tinham serie_id e data final): registra a regra
INSERT INTO reminder_series (id, profile_id, recorrencia, inicio, ate, gerado_ate)
SELECT serie_id, profile_id, max(recorrencia), min(data_hora), max(recorrencia_ate), max(data_hora)
FROM reminders
WHERE serie_id IS NOT NULL AND recorrencia IS NOT NULL
GROUP BY serie_id, profile_id
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
