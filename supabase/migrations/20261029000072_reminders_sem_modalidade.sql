-- Local do evento: endereço (presencial) e link da reunião (online) podem coexistir (reunião híbrida).
-- A coluna "modalidade" (presencial OU online) deixou de ser usada: o tipo sai dos campos preenchidos.
ALTER TABLE reminders DROP COLUMN IF EXISTS modalidade;
