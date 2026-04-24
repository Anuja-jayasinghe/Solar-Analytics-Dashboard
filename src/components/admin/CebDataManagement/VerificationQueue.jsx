import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '@clerk/clerk-react';

const VerificationQueue = ({ onApproveSuccess }) => {
  const { getToken } = useAuth();
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Editable forms state keyed by extraction id
  const [editForms, setEditForms] = useState({});

  const fetchQueue = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase
        .from('ceb_bill_extractions')
        .select(`
            *,
            ceb_bill_ingestions(file_path, status, id)
        `)
        .in('review_status', ['pending_review', 'auto_approved', 'approved'])
        .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch failed parsing attempts (from ingestion table directly)
        const { data: failedIngestions, error: failedError } = await supabase
            .from('ceb_bill_ingestions')
            .select('id, file_path, status, received_at')
            .in('status', ['failed_api_limit', 'failed_extraction'])
            .order('received_at', { ascending: false });

        if (failedError) throw failedError;

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

        setQueue(mergedQueue.filter(i => i.review_status !== 'approved'));
        setHistory(mergedQueue.filter(i => i.review_status === 'approved').sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)));

        const initials = {};
        mergedQueue.forEach(item => {
            initials[item.id] = {
                billing_period_start: item.billing_period_start || '',
                billing_period_end: item.billing_period_end || '',
                meter_reading: item.meter_reading || '',
                units_exported: item.units_exported || '',
                earnings: item.earnings || '',
            };
        });
        setEditForms(initials);
    } catch (err) {
        console.error('Failed to fetch verification queue', err);
        setMessage({ type: 'error', text: 'Failed to load review queue.' });
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
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

  const handleApprove = async (item) => {
    setProcessingId(item.id);
    setMessage(null);
    try {
        const formData = editForms[item.id];
        if (!formData.billing_period_start || !formData.billing_period_end || !formData.meter_reading || !formData.units_exported || !formData.earnings) {
            throw new Error('Please fill out all required fields before saving.');
        }

        const cleanData = {
            bill_date: formData.billing_period_end, // primary chart anchor
            billing_period_start: formData.billing_period_start,
            billing_period_end: formData.billing_period_end,
            meter_reading: parseFloat(formData.meter_reading),
            units_exported: parseFloat(formData.units_exported),
            earnings: parseFloat(formData.earnings)
        };

        const { error: insertError } = await supabase
            .from('ceb_data')
            .insert([cleanData]);

        if (insertError) throw insertError;

        const { error: extError } = await supabase
            .from('ceb_bill_extractions')
            .update({ 
                review_status: 'approved',
                meter_reading: cleanData.meter_reading,
                units_exported: cleanData.units_exported,
                earnings: cleanData.earnings,
                billing_period_start: cleanData.billing_period_start,
                billing_period_end: cleanData.billing_period_end
            })
            .eq('id', item.id);
        
        if (extError) throw extError;

        await supabase
            .from('ceb_bill_ingestions')
            .update({ status: 'approved' })
            .eq('id', item.ingestion_id);

        setMessage({ type: 'success', text: `Bill approved and data saved!` });
        fetchQueue();
        if (onApproveSuccess) onApproveSuccess();
    } catch (err) {
        setMessage({ type: 'error', text: err.message });
    }
    setProcessingId(null);
  };

  const handleReject = async (item) => {
     setProcessingId(item.id);
     
     // Instantly hide from UI
     setQueue(prev => prev.filter(q => q.id !== item.id));

     try {
       const ingestionId = item.ingestion_id || (typeof item.id === 'string' && item.id.includes('failed-') ? item.id.replace('failed-', '') : item.id);
       
       if (typeof item.id === 'string' && item.id.startsWith('failed-')) {
           const { error } = await supabase
             .from('ceb_bill_ingestions')
             .update({ status: 'rejected' })
             .eq('id', ingestionId);
           if (error) throw error;
       } else {
           const { error } = await supabase
             .from('ceb_bill_extractions')
             .update({ review_status: 'rejected' })
             .eq('id', item.id);
           if (error) throw error;
           
           await supabase
             .from('ceb_bill_ingestions')
             .update({ status: 'rejected' })
             .eq('id', ingestionId);
       }
     } catch (err) {
       console.error("Reject error", err);
       fetchQueue(); // restore UI if it failed
     }
     setProcessingId(null);
  };

  const handleRetryParse = async (ingestionId) => {
    setMessage({ type: 'success', text: 'Retrying parsing...' });
    try {
        const token = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME 
            ? await getToken({ template: import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME }) 
            : await getToken();

        const response = await fetch('/api/ceb-bills/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ ingestionId })
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(()=>({}));
            throw new Error(errData.error || 'Parsing failed on retry.');
        }

        setMessage({ type: 'success', text: 'Parsing completed successfully!' });
        fetchQueue();
    } catch (error) {
        setMessage({ type: 'error', text: error.message });
    }
  };

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Loading Review Queue...</div>;

  return (
    <div style={{ marginTop: '2rem', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ background: 'rgba(255, 193, 7, 0.1)', borderBottom: '1px solid var(--border-color)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div>
            <h3 style={{ margin: 0, color: '#ffc107', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔍</span> Parsing Review Queue ({queue.length})
            </h3>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              These bills have been programmatically parsed and await your final check.
            </p>
         </div>
         <button onClick={fetchQueue} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-color)', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}>
            Refresh
         </button>
      </div>

      <div style={{ padding: '1rem', background: 'var(--card-bg)' }}>
         {message && (
            <div style={{ padding: '0.75rem', background: message.type === 'error' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)', color: message.type === 'error' ? '#f44336' : '#4caf50', borderRadius: '6px', marginBottom: '1rem', fontSize: '14px', border: `1px solid ${message.type === 'error' ? '#f44336' : '#4caf50'}` }}>
              {message.text}
            </div>
         )}

         {queue.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: '2rem 0' }}>All clear! No bills waiting for review.</p>
         ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               {queue.map((item) => {
                 const isFailed = item.id.startsWith('failed-');
                 const ingPath = item.ceb_bill_ingestions?.file_path || 'Unknown File';
                 const fileName = ingPath.split('/').pop();
                 const formData = editForms[item.id] || {};

                 return (
                    <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                           <strong style={{ color: 'var(--text-color)' }}>
                              {item.billing_month || 'Unknown Month'} <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)', fontSize: '12px' }}>{fileName}</span>
                           </strong>
                           {item.review_status === 'pending_review' && <span style={{ color: '#ff9800', fontSize: '12px', fontWeight: 'bold' }}>⚠️ NEEDS REVIEW</span>}
                           {item.review_status === 'auto_approved' && <span style={{ color: '#4caf50', fontSize: '12px', fontWeight: 'bold' }}>✅ LOOKS GOOD</span>}
                           {isFailed && <span style={{ color: '#f44336', fontSize: '12px', fontWeight: 'bold' }}>❌ PARSE FAILED</span>}
                       </div>

                       {isFailed ? (
                          <div style={{ border: '1px dashed #f44336', padding: '1rem', borderRadius: '6px', color: '#f44336', textAlign: 'center', fontSize: '13px' }}>
                             Could not parse structured data from this PDF.<br/>
                             <button onClick={() => handleRetryParse(item.ingestion_id)} style={{ marginTop: '0.5rem', background: '#f44336', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Retry Parsing</button>
                          </div>
                       ) : (
                          <>
                             {/* Validation Warnings */}
                             {item.validation_errors && item.validation_errors.length > 0 && (
                                <div style={{ background: 'rgba(255, 152, 0, 0.1)', borderLeft: '3px solid #ff9800', padding: '0.5rem 0.75rem', marginBottom: '1rem', fontSize: '13px', color: '#ff9800' }}>
                                   {item.validation_errors.map((err, i) => <div key={i}>• {err}</div>)}
                                </div>
                             )}

                             {/* Editable Fields Grid */}
                             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                 <div>
                                     <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Period Start</label>
                                     <input type="date" value={formData.billing_period_start} onChange={e => handleFormChange(item.id, 'billing_period_start', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }} />
                                 </div>
                                 <div>
                                     <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Period End</label>
                                     <input type="date" value={formData.billing_period_end} onChange={e => handleFormChange(item.id, 'billing_period_end', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }} />
                                 </div>
                                 <div>
                                     <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Current Meter Reading</label>
                                     <input type="number" value={formData.meter_reading} onChange={e => handleFormChange(item.id, 'meter_reading', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }} />
                                 </div>
                                 <div>
                                     <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Units Exported</label>
                                     <input type="number" value={formData.units_exported} onChange={e => handleFormChange(item.id, 'units_exported', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }} />
                                 </div>
                                 <div style={{ gridColumn: '1 / -1' }}>
                                     <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Earnings (Rs)</label>
                                     <input type="number" step="0.01" value={formData.earnings} onChange={e => handleFormChange(item.id, 'earnings', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }} />
                                 </div>
                             </div>
                          </>
                       )}

                       {/* Action Buttons */}
                       <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                          <button title="Reject & Remove" onClick={() => handleReject(item)} disabled={processingId === item.id} style={{ background: 'transparent', color:'var(--text-secondary)', border:'1px solid var(--border-color)', padding:'0.4rem 1rem', borderRadius:'6px', cursor:'pointer' }}>
                             {processingId === item.id ? '...' : 'Reject'}
                          </button>
                          {!isFailed && (
                              <>
                                  <button onClick={() => handleRetryParse(item.ingestion_id)} disabled={processingId === item.id} style={{ background: 'transparent', color:'#2196f3', border:'1px solid #2196f3', padding:'0.4rem 1rem', borderRadius:'6px', cursor:'pointer' }}>
                                     Re-parse
                                  </button>
                                  <button onClick={() => handleApprove(item)} disabled={processingId === item.id} style={{ background: '#4caf50', color:'white', border:'none', padding:'0.4rem 1.5rem', borderRadius:'6px', cursor:'pointer', fontWeight:'bold' }}>
                                     {processingId === item.id ? 'Saving...' : 'Approve & Save'}
                                  </button>
                              </>
                          )}
                       </div>
                    </div>
                 );
               })}
            </div>
         )}

         {/* Verified History Section */}
         <div style={{ marginTop: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
            <button 
               onClick={() => setShowHistory(!showHistory)}
               style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
               <span style={{ fontWeight: 'bold', fontSize: '14px' }}>📜 Verified History ({history.length})</span>
               <span>{showHistory ? '▲' : '▼'}</span>
            </button>
            
            {showHistory && (
               <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.1)' }}>
                  {history.length === 0 ? (
                     <p style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>No approved extractions yet.</p>
                  ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {history.map(item => (
                           <div key={item.id} style={{ padding: '0.75rem', background: 'rgba(76, 175, 80, 0.05)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                 <strong style={{ color: '#4caf50' }}>{item.billing_month}</strong>
                                 <span style={{ marginLeft: '1rem', fontSize: '12px', color: 'var(--text-secondary)' }}>{item.units_exported} Units | Rs. {item.earnings}</span>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Approved: {new Date(item.updated_at).toLocaleDateString()}</div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            )}
         </div>

      </div>
    </div>
  );
};

export default VerificationQueue;
