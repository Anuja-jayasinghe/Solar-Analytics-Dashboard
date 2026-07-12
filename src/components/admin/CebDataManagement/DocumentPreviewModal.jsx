import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, X } from 'lucide-react';

/**
 * Document Preview Modal
 * Renders a signed Supabase Storage URL (PDF) in an iframe.
 * Mobile browsers render PDF-in-iframe inconsistently, so an
 * "Open document" fallback is always available, promoted to the
 * primary action on small screens.
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
          maxWidth: '900px',
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
          ) : (
            <iframe
              src={url}
              title="Document Preview"
              className="doc-preview-iframe"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </div>

        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="doc-preview-mobile-action">
            Open document
          </a>
        )}
      </div>

      <style>{`
        .doc-preview-mobile-action {
          display: none;
        }
        @media (max-width: 640px) {
          .doc-preview-modal {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            border-radius: 0 !important;
          }
          .doc-preview-mobile-action {
            display: block;
            text-align: center;
            padding: 0.75rem;
            border-top: 1px solid var(--border-color);
            background: var(--accent, #4caf50);
            color: #fff;
            font-weight: 600;
            font-size: 0.9rem;
            text-decoration: none;
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
