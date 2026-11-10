-- 2026-11-10_bill_intake_source.sql
--
-- LR-005 step 6 (issue #242): record where a bill came from, so a repeated email changes nothing.
--
-- WHEN TO RUN: any time. Safe before or after any code deploy; nothing reads the new index yet.
-- Take a DB Snapshot first (Actions → DB Snapshot), per docs/MIGRATIONS.md.
--
-- WHAT IT DOES
-- `ceb_bill_ingestions` already has the two columns the email intake needs, from the 2026-04-23
-- design (2026-04-23_create_ceb_bill_ingestions.sql):
--   source_type        'manual_upload' (the admin page, the default) or 'email_forward' (LR-005)
--   source_message_id  the Resend email_id for an emailed bill; null for an upload
-- This file:
--   1. adds both columns if a project somehow lacks them (a no-op on the live project, which has them),
--   2. adds a unique index on (source_type, source_message_id) for rows that have a message id, so a
--      webhook Resend delivers twice, or the same email forwarded again, cannot create a second ingestion
--      (LR-005 rule 4). Uploads (message id null) are not affected; their duplicates are still caught by
--      the existing unique file_sha256 index.
--
-- Idempotent: running it twice is harmless.

alter table public.ceb_bill_ingestions add column if not exists source_type text not null default 'manual_upload';
alter table public.ceb_bill_ingestions add column if not exists source_message_id text;

create unique index if not exists uq_ceb_bill_ingestions_source_message
  on public.ceb_bill_ingestions (source_type, source_message_id)
  where source_message_id is not null;

-- VERIFY (expect: the index listed; every existing row 'manual_upload' with no message id, or
-- whatever earlier tests left, and no duplicate (source_type, source_message_id) pairs):
--
--   select indexname, indexdef from pg_indexes
--    where tablename = 'ceb_bill_ingestions' and indexname = 'uq_ceb_bill_ingestions_source_message';
--
--   select source_type, count(*) as rows, count(source_message_id) as with_message_id
--     from public.ceb_bill_ingestions group by source_type;
--
-- If the index fails to build, an existing pair is duplicated. Find it with:
--   select source_type, source_message_id, count(*) from public.ceb_bill_ingestions
--    where source_message_id is not null group by 1, 2 having count(*) > 1;
--
-- ROLLBACK (the columns predate this file, so only the index is removed):
--   drop index if exists public.uq_ceb_bill_ingestions_source_message;
