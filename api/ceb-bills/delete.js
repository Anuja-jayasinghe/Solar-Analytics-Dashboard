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
        const { ingestionId } = req.body;
        if (!ingestionId) return res.status(400).json({ error: 'Missing ingestionId' });

        // 1. Get the ingestion record to find the file path
        const { data: ingestion, error: fetchError } = await supabase
            .from('ceb_bill_ingestions')
            .select('file_path')
            .eq('id', ingestionId)
            .single();

        if (fetchError) {
            console.error('Failed to fetch ingestion:', fetchError);
            return res.status(404).json({ error: 'Ingestion not found' });
        }

        // 2. Delete the physical file from storage
        if (ingestion.file_path) {
            const { error: storageError } = await supabase
                .storage
                .from(BUCKET)
                .remove([ingestion.file_path]);
            
            if (storageError) {
                console.error('Failed to delete file from storage:', storageError);
                // We continue anyway to ensure the DB is cleaned up
            }
        }

        // 3. Delete any extractions (if not handled by cascade)
        await supabase.from('ceb_bill_extractions').delete().eq('ingestion_id', ingestionId);

        // 4. Delete the ingestion record
        const { error: deleteError } = await supabase
            .from('ceb_bill_ingestions')
            .delete()
            .eq('id', ingestionId);

        if (deleteError) throw deleteError;

        return res.status(200).json({ success: true, message: 'File and records completely deleted.' });

    } catch (err) {
        console.error('CEB Delete error:', err);
        return res.status(500).json({ error: 'Internal server error during deletion.', details: err.message });
    }
}
