# Cross-Browser/Mobile Consistent Document Preview

## Problem

`DocumentPreviewModal.jsx` (the CEB bill document preview) renders PDFs via a raw `<iframe src={signedUrl}>`. This delegates entirely to each browser's native PDF viewer plugin, which draws its own full toolbar (page navigation, zoom, print, download, more-options) *inside* the iframe — duplicating the modal's own header controls (Open in new tab, Download, Close) and leaving a small, cramped area for the actual document. This native-viewer behavior is also inconsistent: Chrome, Firefox, and Safari each render a differently-styled toolbar, and mobile browsers frequently don't render inline PDFs in iframes at all (often forcing a download or showing a blank frame instead), which is why a mobile-only "Open document" fallback banner was added previously as a workaround.

## Approach

Detect the previewed file's type from its filename extension (already available as the `fileName` prop, derived in `CebDataManagement/index.jsx` from the storage `file_path`):

- **PDF files** (`.pdf`): render with `react-pdf` (`^10.4.1`), which wraps `pdfjs-dist` and draws the page ourselves via canvas — the same rendering on every desktop browser and on mobile (iOS Safari, Chrome Android), with zero reliance on a native viewer's UI.
- **Image files** (`.png`, `.jpg`, `.jpeg`): render with a plain `<img src={url} />` — images already render identically everywhere; the toolbar problem is exclusively a PDF-viewer-plugin issue, so no library is needed here.

## Scope

**Modified:**
- `src/components/admin/CebDataManagement/DocumentPreviewModal.jsx` — replace the `<iframe>` body with the type-branch above; add our own zoom (−/+) and page-navigation ("◀ Page X of Y ▶", hidden when the PDF has only one page) controls; add a friendly error fallback (Open in new tab / Download links) if `react-pdf` fails to parse a PDF, instead of a blank/broken area.
- `package.json` — add `react-pdf` as a dependency.

**Not modified:**
- The modal's header (title, Open-in-new-tab, Download, Close icons), the `createPortal` rendering approach, Escape-key/backdrop-click-to-close, and body-scroll-lock — all already correct, untouched.
- `CebDataManagement/index.jsx`'s `handlePreview` (creates the Supabase signed URL) and `previewFileName` derivation — untouched; the modal already receives everything it needs (`url`, `fileName`, `loading`, `open`, `onClose`).
- The existing mobile fallback banner and its CSS media query are removed as part of this change, since `react-pdf`'s canvas rendering works consistently on mobile — there's no longer a browser-native-viewer gap to work around for PDFs, and images never needed it. The header's "Open in new tab"/"Download" links remain as a general-purpose escape hatch regardless of preview method.

## Performance

`pdfjs-dist` (react-pdf's dependency) is a genuinely large payload (~1MB+ including its worker script). This feature is admin-only (reachable only from the CEB Billing Data tab of `/admin/dashboard`, itself already a separately-lazy-loaded route chunk), so the cost is contained to the admin bundle. Within that, the `react-pdf`-dependent rendering path is further lazy-loaded via `React.lazy()` so the payload is only fetched the first time an admin actually opens a PDF preview, not on every admin dashboard load.

## Vite integration note

`react-pdf` needs `pdfjs.GlobalWorkerOptions.workerSrc` set to a working URL for the PDF.js worker script. The standard Vite-compatible pattern (per react-pdf's own docs) is:
```js
import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
```

## Verification

- `npm run build` and `npx eslint` after the change.
- Visual verification via the same disposable test-admin + headless-browser approach used for the admin UI unification work, viewing a real uploaded CEB bill PDF, confirming: no native browser toolbar visible, our own zoom/page controls work, the modal fills a reasonable amount of screen space, and an image-type upload (if one exists in test data) still renders correctly via the plain `<img>` path.
- User's own browser/device check afterward, specifically on whatever mobile device is convenient, since that's the platform most likely to reveal a remaining gap.

## Rollout

Single branch (`fix/pdf-preview-cross-browser`), one commit for the dependency + modal rewrite, verified and deployed the same way as prior fixes this session (build check → merge to `main` → push → `vercel --prod` → verify `200`).
