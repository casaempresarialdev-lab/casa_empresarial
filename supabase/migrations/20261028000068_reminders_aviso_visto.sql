-- Quando o usuário viu o aviso do lembrete (abriu o sino ou a página de notificações).
-- O contador vermelho do sino mostra só os avisos ainda não vistos.
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS aviso_visto_em timestamptz;
