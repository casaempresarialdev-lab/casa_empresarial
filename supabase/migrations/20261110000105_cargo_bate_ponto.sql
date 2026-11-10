-- Cargo que registra ponto: define se quem ocupa o cargo vê Bater ponto e Meu ponto na página inicial.
-- Pode ser executada de novo sem efeito colateral.

ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS bate_ponto BOOLEAN NOT NULL DEFAULT TRUE;

NOTIFY pgrst, 'reload schema';
