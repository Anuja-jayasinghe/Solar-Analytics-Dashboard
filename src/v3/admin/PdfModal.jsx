import { useEffect, useRef, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { Note } from '../ui/Note.jsx';
import { useAdminApi } from './useAdmin.js';
import { Portal } from '../ui/Portal.jsx';

/**
 * A bill PDF shown inside the dashboard. The server signs a five-minute link for a file that belongs to a
 * known upload (POST /api/ceb-bills/signed-url); the browser never gets standing access to the bucket.
 */
export function PdfModal({ filePath, title, onClose }) {
  const api = useAdminApi();
  const [state, setState] = useState({ url: null, error: null });
  const closeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api.signedUrl(filePath)
      .then((r) => { if (alive) setState({ url: r.signedUrl, error: null }); })
      .catch((err) => { if (alive) setState({ url: null, error: err?.status === 404 ? 'This bill has no stored PDF.' : `Could not open the PDF (${err?.code ?? 'error'}).` }); });
    return () => { alive = false; };
  }, [api, filePath]);

  useEffect(() => {
    closeRef.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  // Drawn in the top layer: inside a card the frosted-glass effect trapped it (only half was visible).
  return (
    <Portal>
    <div className="v3-modal-backdrop" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="v3-glass v3-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="v3-modal-head">
          <b>{title}</b>
          <span style={{ display: 'flex', gap: 8 }}>
            {state.url && <a className="v3-btn" href={state.url} target="_blank" rel="noopener noreferrer">Open in a new tab</a>}
            <button ref={closeRef} type="button" className="v3-iconbtn" aria-label="Close preview" onClick={onClose}><Icon id="close" size={17} /></button>
          </span>
        </div>
        {state.error && <Note tone="bad">{state.error}</Note>}
        {!state.url && !state.error && <div className="v3-skeleton" style={{ flex: 1 }} aria-busy="true" aria-label="Loading the PDF" />}
        {state.url && <iframe className="v3-pdfframe" src={state.url} title={title} />}
      </div>
    </div>
    </Portal>
  );
}
