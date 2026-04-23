-- Migration: Create ceb_bill_extractions table
-- Target: Supabase PostgreSQL
-- Purpose: Stage OCR extraction output for manual review

CREATE TABLE IF NOT EXISTS ceb_bill_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingestion_id UUID REFERENCES ceb_bill_ingestions(id) ON DELETE CASCADE,
    account_number TEXT,
    billing_month TEXT,
    billing_period_start DATE,
    billing_period_end DATE,
    bill_issue_date DATE,
    meter_reading NUMERIC,
    units_exported NUMERIC,
    earnings NUMERIC,
    review_status TEXT DEFAULT 'pending_review' 
        CHECK (review_status IN ('pending_review', 'auto_approved', 'approved', 'rejected')),
    validation_errors JSONB DEFAULT '[]'::jsonb,
    raw_ai_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pending review queue
CREATE INDEX IF NOT EXISTS idx_ceb_bill_extractions_review_status
    ON ceb_bill_extractions (review_status);

-- Optional: trigger for updated_at
CREATE OR REPLACE FUNCTION update_ceb_bill_extractions_moddatetime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ceb_bill_extractions_moddatetime ON ceb_bill_extractions;

CREATE TRIGGER trigger_update_ceb_bill_extractions_moddatetime
    BEFORE UPDATE ON ceb_bill_extractions
    FOR EACH ROW
    EXECUTE FUNCTION update_ceb_bill_extractions_moddatetime();
