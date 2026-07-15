# Cross-Browser/Mobile PDF Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the iframe-based PDF preview (which delegates to each browser's inconsistent native PDF viewer) with a self-rendered, consistent preview using `react-pdf`, while leaving image previews on a plain `<img>` tag.

**Architecture:** A new `PdfPreview.jsx` component owns all `react-pdf`/`pdfjs` rendering, zoom, and page-navigation state. `DocumentPreviewModal.jsx` branches on file extension: PDFs render via a lazy-loaded `PdfPreview`, images render via a plain `<img>`. The modal's header, portal, and close/escape behavior are unchanged.

**Tech Stack:** React 19, `react-pdf` ^10.4.1 (new dependency, wraps `pdfjs-dist`), Vite 7.

## Global Constraints

- The modal's header (title, Open-in-new-tab, Download, Close icons), `createPortal` rendering, Escape-key/backdrop-click-to-close, and body-scroll-lock must remain exactly as they are today — only the document-rendering area (currently the `<iframe>`) changes.
- `CebDataManagement/index.jsx`'s `handlePreview`/`previewFileName` logic is not touched — the modal already receives `url`, `fileName`, `loading`, `open`, `onClose` and that contract stays the same.
- The existing mobile-only fallback banner (and its CSS media query) is removed as part of this change — `react-pdf` renders consistently on mobile, so it's no longer needed for PDFs, and images never needed it.
- `react-pdf`'s rendering path must be lazy-loaded (`React.lazy`), not imported eagerly at the top of `DocumentPreviewModal.jsx`, so its ~1MB+ payload only loads when a preview is actually opened.

---

### Task 1: Add the `react-pdf` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run: `npm install react-pdf@^10.4.1`
Expected: `package.json`'s `dependencies` gains `"react-pdf": "^10.4.1"` (or whatever exact version npm resolves within that range), and `package-lock.json`/`node_modules` update accordingly. (Note: this repo's canonical lockfile is `pnpm-lock.yaml` per its `.npmrc`/`.gitignore` — `package-lock.json` is gitignored and won't be committed; that's expected and already configured from earlier work this session. If a `pnpm-lock.yaml` update is needed instead, run `pnpm install react-pdf@^10.4.1` if `pnpm` is available; otherwise the `npm install` above is sufficient for local development and the deployed build, since Vercel's build step resolves dependencies from `package.json` server-side regardless of which lockfile is present locally.)

- [ ] **Step 2: Verify the install**

Run: `npm ls react-pdf`
Expected: shows `react-pdf@10.4.1` (or close) with no `UNMET DEPENDENCY` errors.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add react-pdf dependency for consistent PDF preview rendering"
```

(If a lockfile change needs to be committed too, e.g. `pnpm-lock.yaml`, include it in this same commit: `git add package.json pnpm-lock.yaml`.)

---

### Task 2: Create `PdfPreview.jsx`

**Files:**
- Create: `src/components/admin/CebDataManagement/PdfPreview.jsx`

**Interfaces:**
- Consumes: nothing from other tasks in this plan.
- Produces: a default-exported React component with the signature `PdfPreview({ url })`, rendering the PDF at `url` with its own zoom and page-navigation controls, and a friendly error state if the PDF fails to load. This is the component Task 3 lazy-imports.

- [ ] **Step 1: Write the file**

```jsx
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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
```

- [ ] **Step 2: Verify no import errors**

Run: `npx eslint src/components/admin/CebDataManagement/PdfPreview.jsx`
Expected: no errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds (this file isn't wired up to anything yet after this task alone, but it must at least compile standalone with no syntax/import errors)

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/CebDataManagement/PdfPreview.jsx
git commit -m "feat: add PdfPreview component using react-pdf for consistent rendering"
```

---

### Task 3: Wire `PdfPreview` into `DocumentPreviewModal.jsx`

**Files:**
- Modify: `src/components/admin/CebDataManagement/DocumentPreviewModal.jsx` (full replacement)

**Interfaces:**
- Consumes: `PdfPreview` from `./PdfPreview` (Task 2), lazy-imported.
- Produces: same default-exported component signature as before — `DocumentPreviewModal({ open, url, loading, fileName, onClose })` — no prop changes, so `CebDataManagement/index.jsx` (which renders `<DocumentPreviewModal open={...} url={...} loading={...} fileName={...} onClose={...} />`) needs no changes.

- [ ] **Step 1: Replace the file content**

```jsx
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
        @media (max-width: 640px) {
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
```

- [ ] **Step 2: Verify no import errors**

Run: `npx eslint src/components/admin/CebDataManagement/DocumentPreviewModal.jsx`
Expected: no errors

- [ ] **Step 3: Verify the consuming file needs no changes**

Run: `grep -n "DocumentPreviewModal" src/components/admin/CebDataManagement/index.jsx`
Expected: shows the existing `<DocumentPreviewModal open={...} url={...} loading={...} fileName={...} onClose={...} />` usage, unchanged and still valid against the new component's identical prop signature — no edit needed here.

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: succeeds. Since `react-pdf`/`pdfjs-dist` is lazy-loaded, expect a new separate chunk file for `PdfPreview` in the build output (e.g. `dist/assets/PdfPreview-<hash>.js`) rather than it being folded into the main `admin` chunk.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/CebDataManagement/DocumentPreviewModal.jsx
git commit -m "fix: render PDF previews via react-pdf instead of iframe for cross-browser/mobile consistency"
```

---

### Task 4: Final verification and rollout

**Files:** none (verification only)

- [ ] **Step 1: Full build + lint pass**

Run: `npm run build && npx eslint .`
Expected: build succeeds; confirm the `PdfPreview` chunk appears as a separate lazy-loaded file in the build output (per Task 3 Step 4); no new lint errors beyond the same pre-existing, already-deferred warnings noted in earlier sessions.

- [ ] **Step 2: Ask user before visual verification**

Ask the user: "Ready for a visual check via the disposable test-admin-account + headless-browser approach used earlier, or would you rather check yourself first?" Proceed based on their answer — if approved, follow the same token-mint / screenshot / cleanup / token-delete pattern used in the admin-UI-unification work (fresh consent per token mint), this time opening the CEB Billing Data tab and clicking the preview button on an existing bill row to screenshot the new PDF preview.

- [ ] **Step 3: User's own device check**

Ask the user to check the preview on their own browser and, if convenient, on a mobile device — that's the platform most likely to reveal any remaining gap, and the whole point of this fix.

- [ ] **Step 4: Push and deploy**

```bash
git push origin main   # or the feature branch, then merge, per user's established preference this session
npx vercel --prod --yes
```

Then verify: `curl -s -o /dev/null -w "%{http_code}\n" https://solaredge.anujajay.com/` — expect `200`.
