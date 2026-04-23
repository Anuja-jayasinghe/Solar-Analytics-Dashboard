-- Step 1 foundation for CEB bill automation
-- Creates ingestion table used by upload endpoint and future OCR pipeline

create extension if not exists pgcrypto;

create table if not exists public.ceb_bill_ingestions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'manual_upload',
  source_message_id text,
  file_path text not null,
  file_sha256 text not null,
  received_at timestamptz not null default now(),
  status text not null default 'received',
  error_message text,
  created_by text
);

create index if not exists idx_ceb_bill_ingestions_received_at
  on public.ceb_bill_ingestions (received_at desc);

create index if not exists idx_ceb_bill_ingestions_status
  on public.ceb_bill_ingestions (status);

create unique index if not exists uq_ceb_bill_ingestions_file_sha256
  on public.ceb_bill_ingestions (file_sha256);

alter table public.ceb_bill_ingestions enable row level security;

-- App-level API currently uses service role key, so these policies are placeholders
-- for future authenticated direct access requirements.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ceb_bill_ingestions'
      and policyname = 'ceb_bill_ingestions_select_authenticated'
  ) then
    create policy ceb_bill_ingestions_select_authenticated
      on public.ceb_bill_ingestions
      for select
      to authenticated
      using (true);
  end if;
end
$$;
