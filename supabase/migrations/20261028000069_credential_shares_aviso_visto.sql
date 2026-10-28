-- Compartilhamento de credencial vira notificação para quem recebeu.
-- Quando o destinatário viu o aviso (abriu o sino ou a página de notificações); o contador do sino conta só os não vistos.
ALTER TABLE credential_shares ADD COLUMN IF NOT EXISTS aviso_visto_em timestamptz;
