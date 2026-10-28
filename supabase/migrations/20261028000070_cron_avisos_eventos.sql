-- Avisos de eventos por e-mail a cada 5 minutos, agendados no próprio Supabase (pg_cron + pg_net).
-- O plano Hobby da Vercel só permite rotinas diárias; lá fica só uma execução por dia, como garantia.
--
-- A tarefa chama a rota do sistema (/api/cron/eventos) com o CRON_SECRET. Endereço e chave ficam no
-- Vault do Supabase (não no código). Antes de aplicar esta migration, crie os dois segredos no SQL Editor:
--
--   select vault.create_secret('https://SEU-DOMINIO/api/cron/eventos', 'eventos_cron_url');
--   select vault.create_secret('O-MESMO-VALOR-DO-CRON_SECRET-DA-VERCEL', 'eventos_cron_secret');
--
-- Sem os segredos, a tarefa roda mas a chamada não acontece (url nula) — nada quebra.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Recria a tarefa (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('enviar-avisos-eventos')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-avisos-eventos');
END $$;

SELECT cron.schedule(
  'enviar-avisos-eventos',
  '*/5 * * * *',
  $job$
    SELECT net.http_get(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'eventos_cron_url'),
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'eventos_cron_secret')
      ),
      timeout_milliseconds := 30000
    )
    WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'eventos_cron_url');
  $job$
);
