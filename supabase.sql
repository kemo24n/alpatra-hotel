-- Run once in Supabase → SQL Editor
create table if not exists alpatra_store (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
-- Lock the table: only the server's secret key can read or write it
alter table alpatra_store enable row level security;
