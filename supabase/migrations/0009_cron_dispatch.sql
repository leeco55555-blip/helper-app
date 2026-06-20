-- Durable cron trigger for /api/internal/cron/dispatch
-- Replaces the external n8n cron that stopped on 2026-06-13.
--
-- Mechanism: Supabase pg_cron fires every minute and pg_net POSTs to the
-- Next.js dispatch endpoint on Vercel with the shared `x-cron-secret` header.
-- Chosen over Vercel Cron because per-minute granularity is guaranteed on any
-- Supabase plan (Vercel Cron only allows per-minute on Pro), it reuses the
-- existing header auth with no endpoint changes, and it runs inside the
-- always-on Postgres next to the data — mirroring n8n's prior cadence exactly.
--
-- The shared secret is read from Supabase Vault (name = 'cron_secret') so it is
-- never stored in the cron.job table or in git. Create it out-of-band with:
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret', '...');
-- and keep the same value in the Vercel `CRON_SECRET` env var.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running this migration replaces the job rather than duplicating it.
do $$
begin
  perform cron.unschedule('helper-cron-dispatch');
exception
  when others then null; -- job did not exist yet
end $$;

select cron.schedule(
  'helper-cron-dispatch',
  '* * * * *', -- every minute, matching the endpoint's +/-2min reminder window
  $cmd$
  select net.http_post(
    url := 'https://helper-app-one.vercel.app/api/internal/cron/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cmd$
);
