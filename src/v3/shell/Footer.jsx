import { APP_VERSION } from '../../../shared/version.js';

export const PORTFOLIO_URL = 'https://anujajay.com';
export const GITHUB_URL = 'https://github.com/Anuja-jayasinghe';
export const RELEASES_URL = 'https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard/releases';

/**
 * The GitHub mark, drawn here because lucide-react removed brand icons in 1.0. The paths are lucide 0.545's own
 * `github` icon (ISC licence), so it looks exactly as before, in the same 24-unit stroke style as the other icons.
 */
function GithubMark({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

/** A quiet signature at the foot of every page, with the version that is live (linked to its release notes). */
export function Footer() {
  return (
    <footer className="v3-footer">
      <span>Built by <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer">Anuja Jayasinghe</a></span>
      <a className="v3-footer-version" href={`${RELEASES_URL}/tag/v${APP_VERSION}`} target="_blank" rel="noopener noreferrer" title="Release notes for this version">
        {`v${APP_VERSION}`}<span className="v3-sr"> release notes</span>
      </a>
      <a className="v3-footer-icon" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="Anuja Jayasinghe on GitHub"><GithubMark size={15} /></a>
    </footer>
  );
}
