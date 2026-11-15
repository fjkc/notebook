-- 0002_claim_source.sql
-- Atomic claim for source processing (NB-007, docs/ARCHITECTURE.md §6 step 2).
-- Run once in the Supabase SQL editor, after 0001_init.sql.
--
-- Moves a source to 'processing' if it's pending, failed, or stuck in processing for more
-- than 5 minutes, and deletes its old chunks in the same statement, so a retry never leaves
-- duplicates. Scoped by owner. Returns the claimed row, or no row if nothing was claimed.

create or replace function public.claim_source(p_id uuid, p_owner_id uuid)
returns setof public.sources
language sql
set search_path = public
as $$
  with claimed as (
    update public.sources
       set status = 'processing', error = null
     where id = p_id
       and owner_id = p_owner_id
       and (
         status in ('pending', 'failed')
         or (status = 'processing' and updated_at < now() - interval '5 minutes')
       )
    returning *
  ),
  removed as (
    delete from public.chunks
     where source_id in (select id from claimed)
  )
  select * from claimed;
$$;

revoke execute on function public.claim_source(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_source(uuid, uuid)
  to service_role;
