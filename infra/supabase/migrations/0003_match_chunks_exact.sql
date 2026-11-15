-- 0003_match_chunks_exact.sql
-- Exact nearest-chunk search per notebook (NB-009, docs/ARCHITECTURE.md §5 and §7).
-- Run once in the Supabase SQL editor, after 0002_claim_source.sql.
--
-- 0001's match_chunks orders all chunks by distance with a WHERE on the notebook. With the global
-- HNSW index, pgvector first takes the ~40 nearest chunks across all notebooks (ef_search) and only
-- then filters, so a small notebook in a large table can get no passages at all. Here the notebook's
-- chunks are selected first (a materialized CTE, so the planner can't push the ORDER BY into the
-- HNSW index) and then sorted exactly. A notebook holds at most ~800 chunks (10 sources of
-- 80,000 characters), so the exact scan is cheap. Same signature and result as before.

create or replace function public.match_chunks(
  p_notebook_id      uuid,
  p_query_embedding  extensions.vector(768),
  p_match_count      int default 8,
  p_source_ids       uuid[] default null
)
returns table (
  id          uuid,
  source_id   uuid,
  chunk_index int,
  page        int,
  content     text,
  similarity  float
)
language sql
stable
set search_path = public, extensions
as $$
  with candidates as materialized (
    select c.id, c.source_id, c.chunk_index, c.page, c.content, c.embedding
    from public.chunks c
    join public.sources s on s.id = c.source_id
    where c.notebook_id = p_notebook_id
      and s.status = 'ready'
      and (p_source_ids is null or c.source_id = any (p_source_ids))
  )
  select
    candidates.id,
    candidates.source_id,
    candidates.chunk_index,
    candidates.page,
    candidates.content,
    1 - (candidates.embedding <=> p_query_embedding) as similarity
  from candidates
  order by candidates.embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- create or replace keeps the existing privileges; repeated here so the file stands on its own.
revoke execute on function public.match_chunks(uuid, extensions.vector, int, uuid[])
  from public, anon, authenticated;
grant execute on function public.match_chunks(uuid, extensions.vector, int, uuid[])
  to service_role;
