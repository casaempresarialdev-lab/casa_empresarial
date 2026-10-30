-- Repetição personalizada (estilo Google Agenda): "a cada N dias/semanas/meses/anos",
-- repetição anual e término após N ocorrências. Rodar depois da 073.

-- A cada N unidades (1 = toda semana, 2 = semana sim, semana não…)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS intervalo int NOT NULL DEFAULT 1 CHECK (intervalo BETWEEN 1 AND 99);
-- Termina após N ocorrências (nulo = sem limite de quantidade)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS ocorrencias int CHECK (ocorrencias BETWEEN 1 AND 999);

ALTER TABLE reminder_series ADD COLUMN IF NOT EXISTS intervalo int NOT NULL DEFAULT 1 CHECK (intervalo BETWEEN 1 AND 99);
ALTER TABLE reminder_series ADD COLUMN IF NOT EXISTS ocorrencias int CHECK (ocorrencias BETWEEN 1 AND 999);
-- Quantas ocorrências a série já criou (para parar ao chegar no limite)
ALTER TABLE reminder_series ADD COLUMN IF NOT EXISTS geradas int NOT NULL DEFAULT 0;

-- Repetição anual
ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_recorrencia_check;
ALTER TABLE reminders ADD CONSTRAINT reminders_recorrencia_check CHECK (recorrencia IN ('diaria', 'semanal', 'mensal', 'anual'));
ALTER TABLE reminder_series DROP CONSTRAINT IF EXISTS reminder_series_recorrencia_check;
ALTER TABLE reminder_series ADD CONSTRAINT reminder_series_recorrencia_check CHECK (recorrencia IN ('diaria', 'semanal', 'mensal', 'anual'));

-- Séries já existentes: conta as ocorrências criadas até agora
UPDATE reminder_series s
SET geradas = (SELECT count(*) FROM reminders r WHERE r.serie_id = s.id)
WHERE geradas = 0;

NOTIFY pgrst, 'reload schema';
