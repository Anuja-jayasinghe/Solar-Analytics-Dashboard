import React, { useEffect, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, X } from 'lucide-react';

const PdfPreview = lazy(() => import('./PdfPreview'));

const isPdfFile = (fileName) => /\.pdf$/i.test(fileName || '');

/**
 * Document Preview Modal
 * Renders a signed Supabase Storage URL — PDFs via react-pdf (consistent
 * across every browser and on mobile), images via a plain <img>.
 */
const DocumentPreviewModal = ({ open, url, loading, fileName = 'document', onClose }) => {
  const [iconHover, setIconHover] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const iconButtonStyle = (key) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '6px',
    background: iconHover === key ? 'rgba(255,255,255,0.1)' : 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'background 0.15s ease',
  });

  const modalContent = (
    <div
      onClick={onClose}
      className="doc-preview-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="doc-preview-modal"
        style={{
          background: 'var(--card-bg-solid, #1a1a1a)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1000px',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.25)',
            gap: '0.75rem',
          }}
        >
          <h3
            style={{
              margin: 0,
              color: 'var(--text-color)',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minWidth: 0,
            }}
          >
            <span>📄</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Document Preview
            </span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
            {url && (
              <>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  style={iconButtonStyle('open')}
                  onMouseEnter={() => setIconHover('open')}
                  onMouseLeave={() => setIconHover(null)}
                >
                  <ExternalLink size={16} />
                </a>
                <a
                  href={url}
                  download={fileName}
                  title="Download"
                  style={iconButtonStyle('download')}
                  onMouseEnter={() => setIconHover('download')}
                  onMouseLeave={() => setIconHover(null)}
                >
                  <Download size={16} />
                </a>
              </>
            )}
            <button
              onClick={onClose}
              title="Close"
              style={iconButtonStyle('close')}
              onMouseEnter={() => setIconHover('close')}
              onMouseLeave={() => setIconHover(null)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative', background: '#525659' }}>
          {loading && !url ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                color: '#ccc',
              }}
            >
              <div className="doc-preview-spinner" />
              <span style={{ fontSize: '0.9rem' }}>Loading secure document link…</span>
            </div>
          ) : isPdfFile(fileName) ? (
            <Suspense
              fallback={
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ccc',
                  }}
                >
                  Loading previewer…
                </div>
              }
            >
              <PdfPreview url={url} />
            </Suspense>
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'auto',
              }}
            >
              <img src={url} alt={fileName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .doc-preview-overlay {
            padding: 0 !important;
          }
          .doc-preview-modal {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            border-radius: 0 !important;
          }
        }
        .doc-preview-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255, 255, 255, 0.2);
          border-top-color: var(--accent, #4caf50);
          border-radius: 50%;
          animation: doc-preview-spin 0.8s linear infinite;
        }
        @keyframes doc-preview-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DocumentPreviewModal;
