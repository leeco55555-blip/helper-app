-- Grant table privileges to Supabase default roles.
-- Supabase normally applies these via default privileges, but our migration
-- created tables before defaults took effect for this session.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

grant select, insert, update, delete on all tables    in schema public to authenticated;
grant usage,  select on              all sequences    in schema public to authenticated;
grant execute on                     all functions    in schema public to authenticated;

grant select, insert, update, delete on all tables    in schema public to anon;
grant usage,  select on              all sequences    in schema public to anon;
grant execute on                     all functions    in schema public to anon;

-- Make sure future tables get the same defaults.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
