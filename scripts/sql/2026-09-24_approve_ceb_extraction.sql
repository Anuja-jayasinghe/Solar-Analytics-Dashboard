-- 2026-09-24_approve_ceb_extraction.sql
--
-- Approve a parsed CEB bill as ONE transaction.
--
-- WHY
-- PUT /api/ceb-bills/records approved a bill with three separate writes — upsert `ceb_data`,
-- mark the extraction approved, mark the ingestion approved. A failure part-way left the bill
-- promoted into `ceb_data` with an ingestion still labelled `auto_approved`. That is the state
-- 20 ingestions were found in, and it was cleared by relabelling rows by hand, which fixed the
-- data but not the cause.
--
-- A plpgsql function runs in a single transaction, so either all three writes land or none do.
--
-- It also enforces something the handler never checked: that the extraction belongs to the
-- ingestion it is being approved against.
--
-- ORDER OF OPERATIONS
-- Safe to apply before OR after the application code that calls it. The handler falls back to
-- the old sequential writes (and logs a warning) while this function is not installed.
--
-- Safe to run more than once.

create or replace function public.approve_ceb_extraction(
  p_extraction_id uuid,
  p_ingestion_id  uuid,
  p_record        jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.ceb_data (
    bill_date, meter_reading, units_exported, earnings,
    account_number, billing_month, billing_period_start, billing_period_end,
    data_source, file_path, ingestion_id
  ) values (
    (p_record ->> 'bill_date')::date,
    (p_record ->> 'meter_reading')::numeric,
    (p_record ->> 'units_exported')::numeric,
    (p_record ->> 'earnings')::numeric,
    p_record ->> 'account_number',
    p_record ->> 'billing_month',
    (p_record ->> 'billing_period_start')::date,
    (p_record ->> 'billing_period_end')::date,
    coalesce(p_record ->> 'data_source', 'manual_entry'),
    p_record ->> 'file_path',
    (p_record ->> 'ingestion_id')::uuid
  )
  on conflict (account_number, billing_month) do update set
    bill_date      = excluded.bill_date,
    meter_reading  = excluded.meter_reading,
    units_exported = excluded.units_exported,
    earnings       = excluded.earnings,
    -- Optional columns are only overwritten when the caller actually sent them, matching the
    -- behaviour of the PostgREST upsert this replaces.
    billing_period_start = case when p_record ? 'billing_period_start'
                                then excluded.billing_period_start
                                else public.ceb_data.billing_period_start end,
    billing_period_end   = case when p_record ? 'billing_period_end'
                                then excluded.billing_period_end
                                else public.ceb_data.billing_period_end end,
    data_source    = case when p_record ? 'data_source'
                          then excluded.data_source
                          else public.ceb_data.data_source end,
    file_path      = case when p_record ? 'file_path'
                          then excluded.file_path
                          else public.ceb_data.file_path end,
    ingestion_id   = case when p_record ? 'ingestion_id'
                          then excluded.ingestion_id
                          else public.ceb_data.ingestion_id end;

  update public.ceb_bill_extractions
     set review_status          = 'approved',
         meter_reading          = (p_record ->> 'meter_reading')::numeric,
         units_exported         = (p_record ->> 'units_exported')::numeric,
         earnings               = (p_record ->> 'earnings')::numeric,
         billing_period_start   = (p_record ->> 'billing_period_start')::date,
         billing_period_end     = (p_record ->> 'billing_period_end')::date
   where id = p_extraction_id
     and (p_ingestion_id is null or ingestion_id = p_ingestion_id);

  if not found then
    -- Raising rolls back the ceb_data write above.
    raise exception 'extraction % not found for ingestion %', p_extraction_id, p_ingestion_id
      using errcode = 'P0002';
  end if;

  if p_ingestion_id is not null then
    update public.ceb_bill_ingestions set status = 'approved' where id = p_ingestion_id;

    if not found then
      raise exception 'ingestion % not found', p_ingestion_id using errcode = 'P0002';
    end if;
  end if;
end;
$$;

-- Callable only by the service role (the API). The function runs with the caller's rights, and
-- anon has no write policies, so this is defence in depth rather than the only barrier.
revoke all on function public.approve_ceb_extraction(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.approve_ceb_extraction(uuid, uuid, jsonb) to service_role;
