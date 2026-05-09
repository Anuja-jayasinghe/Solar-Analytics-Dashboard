import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '../middleware/verifyAdminToken.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const adminUser = await verifyAdminToken(req, res);
    if (!adminUser) return;

    try {
        const { recordId } = req.body;
        if (!recordId) return res.status(400).json({ error: 'Missing recordId' });

        // 1. Fetch the ceb_data record to get ingestion_id
        const { data: record, error: fetchError } = await supabase
            .from('ceb_data')
            .select('ingestion_id')
            .eq('id', recordId)
            .single();

        if (fetchError) {
            console.error('Failed to fetch record:', fetchError);
            return res.status(404).json({ error: 'Record not found' });
        }

        const ingestionId = record.ingestion_id;

        // 2. Delete the record from ceb_data
        const { error: deleteRecordError } = await supabase
            .from('ceb_data')
            .delete()
            .eq('id', recordId);

        if (deleteRecordError) throw deleteRecordError;

        // 3. If there is an associated ingestion, cascade delete it
        if (ingestionId) {
            // Get file path
            const { data: ingestion } = await supabase
                .from('ceb_bill_ingestions')
                .select('file_path')
                .eq('id', ingestionId)
                .single();

            // Delete physical file
            if (ingestion && ingestion.file_path) {
                await supabase
                    .storage
                    .from(BUCKET)
                    .remove([ingestion.file_path]);
            }

            // Delete extractions
            await supabase.from('ceb_bill_extractions').delete().eq('ingestion_id', ingestionId);

            // Delete ingestion record
            await supabase.from('ceb_bill_ingestions').delete().eq('id', ingestionId);
        }

        return res.status(200).json({ success: true, message: 'Record and associated files completely deleted.' });

    } catch (err) {
        console.error('CEB Record Delete error:', err);
        return res.status(500).json({ error: 'Internal server error during deletion.', details: err.message });
    }
}
