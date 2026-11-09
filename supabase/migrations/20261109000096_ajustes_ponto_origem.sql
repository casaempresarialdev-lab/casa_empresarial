-- Ajuste de ponto: localização e IP de onde o pedido foi feito, para quem aprova.
-- Pode ser executada de novo sem efeito colateral.

ALTER TABLE time_adjustments ADD COLUMN IF NOT EXISTS origem JSONB;

NOTIFY pgrst, 'reload schema';
