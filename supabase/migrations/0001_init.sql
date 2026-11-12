-- 0001_init.sql
-- Initial schema. Run once in the Supabase SQL editor (or with `supabase db push`).
-- All access happens server-side with the secret key. RLS is enabled without
-- policies so the public key in the browser cannot read or write any table.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- notebooks
-- ---------------------------------------------------------------------------
create table public.notebooks (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null,
  title               text not null default 'Untitled notebook',
  suggested_questions jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index notebooks_owner_idx on public.notebooks (owner_id, updated_at desc);
create trigger notebooks_updated_at before update on public.notebooks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
create table public.sources (
  id            uuid primary key default gen_random_uuid(),
  notebook_id   uuid not null references public.notebooks (id) on delete cascade,
  owner_id      uuid not null,
  type          text not null check (type in ('pdf', 'text', 'url')),
  title         text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'ready', 'failed')),
  error         text,
  storage_path  text,   -- type = 'pdf'
  url           text,   -- type = 'url'
  input_text    text,   -- type = 'text'
  page_count    int,
  char_count    int,
  summary       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index sources_notebook_idx on public.sources (notebook_id, created_at);
create index sources_owner_idx on public.sources (owner_id, created_at desc);
create trigger sources_updated_at before update on public.sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- chunks (embeddings: 768 dims, cosine distance)
-- ---------------------------------------------------------------------------
create table public.chunks (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references public.sources (id) on delete cascade,
  notebook_id  uuid not null references public.notebooks (id) on delete cascade,
  chunk_index  int not null,
  page         int,
  content      text not null,
  embedding    extensions.vector(768) not null
);
create index chunks_notebook_idx on public.chunks (notebook_id);
create index chunks_source_idx on public.chunks (source_id, chunk_index);
create index chunks_embedding_idx on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  notebook_id  uuid not null references public.notebooks (id) on delete cascade,
  owner_id     uuid not null,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  citations    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index messages_notebook_idx on public.messages (notebook_id, created_at);
create index messages_owner_idx on public.messages (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- notes (generated documents and audio scripts)
-- ---------------------------------------------------------------------------
create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  notebook_id  uuid not null references public.notebooks (id) on delete cascade,
  owner_id     uuid not null,
  kind         text not null check (kind in ('briefing', 'faq', 'study_guide', 'audio')),
  title        text not null,
  content      text not null,   -- markdown, or the JSON script for kind = 'audio'
  audio_path   text,
  created_at   timestamptz not null default now()
);
create index notes_notebook_idx on public.notes (notebook_id, created_at desc);

-- ---------------------------------------------------------------------------
-- vector search
-- ---------------------------------------------------------------------------
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
  select
    c.id,
    c.source_id,
    c.chunk_index,
    c.page,
    c.content,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.chunks c
  join public.sources s on s.id = c.source_id
  where c.notebook_id = p_notebook_id
    and s.status = 'ready'
    and (p_source_ids is null or c.source_id = any (p_source_ids))
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$;

revoke execute on function public.match_chunks(uuid, extensions.vector, int, uuid[])
  from public, anon, authenticated;
grant execute on function public.match_chunks(uuid, extensions.vector, int, uuid[])
  to service_role;

-- ---------------------------------------------------------------------------
-- row level security: enabled, no policies (server-only access)
-- ---------------------------------------------------------------------------
alter table public.notebooks enable row level security;
alter table public.sources   enable row level security;
alter table public.chunks    enable row level security;
alter table public.messages  enable row level security;
alter table public.notes     enable row level security;

-- ---------------------------------------------------------------------------
-- storage buckets (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('sources', 'sources', false, 10485760, array['application/pdf']),
  ('audio',   'audio',   false, 52428800, array['audio/wav'])
on conflict (id) do nothing;
