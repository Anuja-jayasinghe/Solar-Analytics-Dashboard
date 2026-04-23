import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '@clerk/clerk-react';

const VerificationQueue = ({ onApproveSuccess }) => {
  const { getToken } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [unprocessed, setUnprocessed] = useState([]);

  // Editable forms state keyed by extraction id
  const [editForms, setEditForms] = useState({});

  const fetchQueue = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ceb_bill_extractions')
      .select(`
        *,
        ceb_bill_ingestions(file_path, status, id)
      `)
      .in('review_status', ['pending_review', 'auto_approved'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch verification queue', error);
      setMessage({ type: 'error', text: 'Failed to load queue.' });
    } else {
      // Fetch failed ingestions
      const { data: failedIngestions } = await supabase
        .from('ceb_bill_ingestions')
        .select('id, file_path, status, received_at')
        .in('status', ['failed_api_limit', 'failed_extraction'])
        .order('received_at', { ascending: false });

      const mergedQueue = [...(data || [])];
      if (failedIngestions) {
          failedIngestions.forEach(ing => {
              mergedQueue.push({
                  id: `failed-${ing.id}`,
                  ingestion_id: ing.id,
                  review_status: ing.status,
                  ceb_bill_ingestions: {
                      file_path: ing.file_path,
                      id: ing.id
                  }
              });
          });
      }

      setQueue(mergedQueue);
      
      // Initialize edit forms
      const initials = {};
      mergedQueue.forEach(item => {
         initials[item.id] = {
            billing_period_start: item.billing_period_start || '',
            meter_reading: item.meter_reading || '',
            units_exported: item.units_exported || '',
            earnings: item.earnings || '',
         };
      });
      setEditForms(initials);
    }
    
    // Check for unprocessed ingestions
    const { data: unprocessedData } = await supabase
       .from('ceb_bill_ingestions')
       .select('id, file_path')
       .eq('status', 'received');
    setUnprocessed(unprocessedData || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
    
    // Set up an interval or just rely on manual refresh/parent refresh
    // For now we will rely on UI mounting and manual triggers.
  }, []);

  const handleFormChange = (id, field, value) => {
     setEditForms(prev => ({
        ...prev,
        [id]: {
           ...prev[id],
           [field]: value
        }
     }));
  };

  const handleApprove = async (extraction) => {
     setProcessingId(extraction.id);
     setMessage(null);
     
     const form = editForms[extraction.id];
     
     // 1. Insert into ceb_data
     const finalData = {
         bill_date: form.billing_period_start || new Date().toISOString().split('T')[0],
         meter_reading: parseFloat(form.meter_reading) || 0,
         units_exported: parseFloat(form.units_exported) || 0,
         earnings: parseFloat(form.earnings) || 0,
         // We might ideally add source_ingestion_id, entry_mode here if they are in schema
     };
     
     const { error: insertError } = await supabase.from('ceb_data').insert([finalData]);
     
     if (insertError) {
        setProcessingId(null);
        return setMessage({ type: 'error', text: `Failed to insert ceb_data: ${insertError.message}` });
     }
     
     // 2. Update extraction status
     const { error: updateError } = await supabase
       .from('ceb_bill_extractions')
       .update({ review_status: 'approved', ...form })  // save variations
       .eq('id', extraction.id);
       
     // 3. Update ingestion status
     await supabase
       .from('ceb_bill_ingestions')
       .update({ status: 'approved' })
       .eq('id', extraction.ingestion_id);
       
     setProcessingId(null);
     fetchQueue();
     if (onApproveSuccess) onApproveSuccess();
  };

  const handleReject = async (extraction) => {
     setProcessingId(extraction.id);
     if (!String(extraction.id).startsWith('failed-')) {
         await supabase.from('ceb_bill_extractions').update({ review_status: 'rejected' }).eq('id', extraction.id);
     }
     await supabase.from('ceb_bill_ingestions').update({ status: 'rejected' }).eq('id', extraction.ingestion_id);
     setProcessingId(null);
     fetchQueue();
  };
  
  const handleRetryExtraction = async (extraction) => {
     setProcessingId(extraction.id);
     
     try {
       const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME;
       const token = template ? await getToken({ template }) : await getToken();
       
       const response = await fetch('/api/ceb-bills/extract', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
         },
         body: JSON.stringify({ ingestionId: extraction.ingestion_id })
       });
       
       const data = await response.json();
       if (!response.ok) {
           setMessage({ type: 'error', text: `Extract failed: ${data.error}` });
       } else {
           setMessage({ type: 'success', text: 'Extraction successful' });
           fetchQueue();
       }
     } catch (err) {
       setMessage({ type: 'error', text: err.message });
     }
     setProcessingId(null);
  };

  const handleProcessUnprocessed = async () => {
     setProcessingId('batch');
     setMessage(null);
     try {
       const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME;
       
       let successCount = 0;
       const testBillList = unprocessed.length > 0 ? [unprocessed[0]] : [];
       for (const bill of testBillList) {
           let success = false;
           let attempts = 0;
           
           while (!success && attempts < 3) {
               attempts++;
               const token = template ? await getToken({ template }) : await getToken();
               const response = await fetch('/api/ceb-bills/extract', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                 body: JSON.stringify({ ingestionId: bill.id })
               });
               
               if (response.ok) {
                   successCount++;
                   success = true;
               } else if (response.status === 429) {
                   console.warn(`Rate limit hit on try ${attempts} for ${bill.id}. Cooling down for 15 seconds...`);
                   await new Promise(resolve => setTimeout(resolve, 15000));
               } else {
                   const errData = await response.json().catch(()=>({}));
                   console.error(`Batch extract failed for ${bill.id}:`, errData);
                   break; // Fatal error, don't retry
               }
           }
           
           // Sleep for 5 seconds to gracefully stay under 15 RPM limit
           if (unprocessed.indexOf(bill) !== unprocessed.length - 1) {
               await new Promise(resolve => setTimeout(resolve, 5000));
           }
       }
       setMessage({ type: 'success', text: `Successfully extracted ${successCount} of ${unprocessed.length} bills. They are now in the queue below.` });
       fetchQueue();
     } catch(err) {
       setMessage({ type: 'error', text: err.message });
     }
     setProcessingId(null);
  };

  if (loading && queue.length === 0 && unprocessed.length === 0) return <div style={{color:'var(--text-secondary)'}}>Loading Verification Queue...</div>;

  if (queue.length === 0 && unprocessed.length === 0) return null; // Only show if there's pending or unprocessed items

  return (
    <div style={{
      border: "1px solid #ffc107",
      borderRadius: "10px",
      marginTop: "1.5rem",
      marginBottom: "1.5rem",
      background: "var(--card-bg)"
    }}>
      <div style={{ padding: "1rem", background: "rgba(255, 193, 7, 0.1)", borderBottom: "1px solid #ffc107", borderRadius: "10px 10px 0 0" }}>
         <h3 style={{ margin: 0, color: "#ffc107", display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <span>⚠️</span> Verification Queue ({queue.length})
         </h3>
         <p style={{ margin: "0.25rem 0 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
            These bills have been parsed by AI and require human verification.
         </p>
      </div>
      
      {message && (
        <div style={{ padding: '0.75rem 1rem', background: message.type==='error'?'#441111':'#114411', color: message.type==='error'?'#ff7777':'#77ff77', borderBottom: '1px solid var(--border-color)', fontSize:'13px' }}>
            {message.text}
        </div>
      )}

      {unprocessed.length > 0 && (
          <div style={{ padding: '1rem', background: 'rgba(56, 189, 248, 0.1)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div>
                <strong style={{ color: '#38bdf8' }}>{unprocessed.length} Unprocessed Bills Found!</strong>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>You uploaded bills previously that haven't been extracted by AI yet.</p>
             </div>
             <button 
                onClick={handleProcessUnprocessed} 
                disabled={processingId === 'batch' || processingId !== null}
                style={{ background: '#38bdf8', color: '#000', fontWeight: 'bold', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
             >
                {processingId === 'batch' ? 'Extracting...' : `Extract 1 Test Bill`}
             </button>
          </div>
      )}

      <div style={{ padding: "1rem", display: 'flex', flexDirection: 'column', gap: '1rem' }}>
         {queue.map(item => {
           const form = editForms[item.id] || {};
           const errors = item.validation_errors || [];
           
           return (
              <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                 
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <div>
                       <strong style={{color:'var(--text-color)'}}>{item.billing_month || 'Unknown Month'}</strong>
                       <span style={{color:'var(--text-secondary)', fontSize:'12px', marginLeft:'0.5rem'}}>Account: {item.account_number}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily:'monospace' }}>
                       {item.ceb_bill_ingestions?.file_path?.split('/').pop()}
                    </div>
                 </div>

                 {['failed_api_limit', 'failed_extraction'].includes(item.review_status) ? (
                     <div style={{ padding: '1rem', background: 'rgba(255, 50, 50, 0.1)', border: '1px dashed #ff5555', borderRadius: '4px', textAlign: 'center' }}>
                         <p style={{ color: '#ff5555', margin: '0 0 0.5rem 0' }}>{item.review_status === 'failed_api_limit' ? 'API Rate Limit Hit' : 'Extraction Crash / Failed'} during AI run.</p>
                         <button onClick={() => handleRetryExtraction(item)} disabled={processingId === item.id} style={{ background: '#ff5555', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor:'pointer' }}>
                            {processingId === item.id ? 'Retrying...' : 'Retry AI Extraction'}
                         </button>
                     </div>
                 ) : (
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                         {/* Errors Side */}
                         <div>
                            <h4 style={{ margin: '0 0 0.5rem 0', color:'#ff9800', fontSize:'13px' }}>Detected Issues</h4>
                            {errors.length > 0 ? (
                               <ul style={{ margin:0, paddingLeft:'1.5rem', color:'#ff9800', fontSize:'13px', display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                                   {errors.map((err, i) => <li key={i}>{err}</li>)}
                               </ul>
                            ) : (
                               <span style={{ color:'#4caf50', fontSize:'13px' }}>✓ No mathematical or history conflicts detected. Needs final eyeball.</span>
                            )}
                         </div>

                         {/* Editor Side */}
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', gap:'0.5rem', alignItems:'center' }}>
                               <label style={{ width:'100px', fontSize:'12px', color:'var(--text-secondary)' }}>Bill Start Date</label>
                               <input type="date" value={form.billing_period_start} onChange={e => handleFormChange(item.id, 'billing_period_start', e.target.value)} style={{ flex: 1, padding:'0.4rem', background:'var(--bg-color)', color:'var(--text-color)', border:'1px solid var(--border-color)', borderRadius:'4px', colorScheme: 'dark' }} />
                            </div>
                            <div style={{ display: 'flex', gap:'0.5rem', alignItems:'center' }}>
                               <label style={{ width:'100px', fontSize:'12px', color:'var(--text-secondary)' }}>Meter Reading</label>
                               <input type="number" value={form.meter_reading} onChange={e => handleFormChange(item.id, 'meter_reading', e.target.value)} style={{ flex: 1, padding:'0.4rem', background:'var(--bg-color)', color:'var(--text-color)', border:'1px solid var(--border-color)', borderRadius:'4px' }} />
                            </div>
                            <div style={{ display: 'flex', gap:'0.5rem', alignItems:'center' }}>
                               <label style={{ width:'100px', fontSize:'12px', color:'var(--text-secondary)' }}>Units Exported</label>
                               <input type="number" value={form.units_exported} onChange={e => handleFormChange(item.id, 'units_exported', e.target.value)} style={{ flex: 1, padding:'0.4rem', background:'var(--bg-color)', color:'var(--text-color)', border:'1px solid var(--border-color)', borderRadius:'4px' }} />
                            </div>
                            <div style={{ display: 'flex', gap:'0.5rem', alignItems:'center' }}>
                               <label style={{ width:'100px', fontSize:'12px', color:'var(--text-secondary)' }}>Earnings (Rs)</label>
                               <input type="number" value={form.earnings} onChange={e => handleFormChange(item.id, 'earnings', e.target.value)} style={{ flex: 1, padding:'0.4rem', background:'var(--bg-color)', color:'var(--text-color)', border:'1px solid var(--border-color)', borderRadius:'4px' }} />
                            </div>
                         </div>
                     </div>
                 )}

                 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingTop:'1rem', borderTop: '1px solid var(--border-color)' }}>
                     <button title="Reject & Ignore" onClick={() => handleReject(item)} disabled={processingId === item.id} style={{ background: 'transparent', color:'var(--text-secondary)', border:'1px solid var(--border-color)', padding:'0.4rem 1rem', borderRadius:'6px', cursor:'pointer' }}>
                        Reject
                     </button>
                     {!['failed_api_limit', 'failed_extraction'].includes(item.review_status) && (
                         <button onClick={() => handleApprove(item)} disabled={processingId === item.id} style={{ background: '#4caf50', color:'white', border:'none', padding:'0.4rem 1.5rem', borderRadius:'6px', cursor:'pointer', fontWeight:'bold' }}>
                            {processingId === item.id ? 'Saving...' : 'Approve & Save'}
                         </button>
                     )}
                 </div>
              </div>
           );
         })}
      </div>
    </div>
  );
};

export default VerificationQueue;
