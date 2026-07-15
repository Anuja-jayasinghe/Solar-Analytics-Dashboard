import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const ZOOM_STEP = 0.2;
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;

const controlButtonStyle = (disabled) => ({
  width: '28px',
  height: '28px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  background: 'transparent',
  color: disabled ? 'var(--text-muted)' : 'var(--text-color)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '0.9rem',
});

/**
 * Renders a PDF via pdf.js canvas rendering (identical across every browser
 * and on mobile, unlike a raw <iframe> which delegates to each browser's
 * own, inconsistent native PDF viewer), with our own zoom and
 * page-navigation controls.
 */
export default function PdfPreview({ url }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState(null);

  if (error) {
    return (
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
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '0.95rem' }}>Couldn't preview this document.</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
        >
          Open it directly instead
        </a>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
        <Document
          file={url}
          onLoadSuccess={({ numPages: total }) => setNumPages(total)}
          onLoadError={(err) => setError(err)}
          loading={<div style={{ color: '#ccc', padding: '2rem' }}>Loading document…</div>}
        >
          <Page pageNumber={pageNumber} scale={scale} />
        </Document>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '0.6rem 1rem',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - ZOOM_STEP).toFixed(1)))}
            disabled={scale <= MIN_SCALE}
            style={controlButtonStyle(scale <= MIN_SCALE)}
          >
            −
          </button>
          <span style={{ color: '#ccc', fontSize: '0.8rem', minWidth: '3.5rem', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + ZOOM_STEP).toFixed(1)))}
            disabled={scale >= MAX_SCALE}
            style={controlButtonStyle(scale >= MAX_SCALE)}
          >
            +
          </button>
        </div>

        {numPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              style={controlButtonStyle(pageNumber <= 1)}
            >
              ◀
            </button>
            <span style={{ color: '#ccc', fontSize: '0.8rem' }}>
              Page {pageNumber} of {numPages}
            </span>
            <button
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              style={controlButtonStyle(pageNumber >= numPages)}
            >
              ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
