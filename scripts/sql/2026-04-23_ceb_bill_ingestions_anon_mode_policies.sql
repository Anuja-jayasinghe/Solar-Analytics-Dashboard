-- Use this script only when backend uses SUPABASE_ANON_KEY instead of service_role.
-- It enables anon-role access that is restricted by API auth in the app layer.

-- 1) Table policies for anon role on ceb_bill_ingestions
alter table public.ceb_bill_ingestions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ceb_bill_ingestions'
      and policyname = 'ceb_bill_ingestions_select_anon'
  ) then
    create policy ceb_bill_ingestions_select_anon
      on public.ceb_bill_ingestions
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ceb_bill_ingestions'
      and policyname = 'ceb_bill_ingestions_insert_anon'
  ) then
    create policy ceb_bill_ingestions_insert_anon
      on public.ceb_bill_ingestions
      for insert
      to anon
      with check (
        source_type in ('manual_upload', 'email_forward', 'auto_mailbox')
        and file_path is not null
        and file_sha256 is not null
      );
  end if;
end
$$;

-- 2) Storage bucket + policies for anon role on private bucket `ceb_bills`

insert into storage.buckets (id, name, public)
values ('ceb_bills', 'ceb_bills', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ceb_bills_insert_anon'
  ) then
    create policy ceb_bills_insert_anon
      on storage.objects
      for insert
      to anon
      with check (bucket_id = 'ceb_bills');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ceb_bills_select_anon'
  ) then
    create policy ceb_bills_select_anon
      on storage.objects
      for select
      to anon
      using (bucket_id = 'ceb_bills');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ceb_bills_delete_anon'
  ) then
    create policy ceb_bills_delete_anon
      on storage.objects
      for delete
      to anon
      using (bucket_id = 'ceb_bills');
  end if;
end
$$;
