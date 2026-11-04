-- Advisor: public."Notification" is exposed through the Data API with RLS off.
-- This app does not query that table. Enabling RLS with no policy closes
-- anon and authenticated access. The service role still bypasses RLS.

do $$
begin
  if to_regclass('public."Notification"') is not null then
    execute 'alter table public."Notification" enable row level security';
    execute 'revoke all on table public."Notification" from anon, authenticated';
  elsif to_regclass('public.notification') is not null then
    execute 'alter table public.notification enable row level security';
    execute 'revoke all on table public.notification from anon, authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';
