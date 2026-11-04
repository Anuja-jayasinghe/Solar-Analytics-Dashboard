import { Github } from 'lucide-react';
import { APP_VERSION } from '../../../shared/version.js';

export const PORTFOLIO_URL = 'https://anujajay.com';
export const GITHUB_URL = 'https://github.com/Anuja-jayasinghe';
export const RELEASES_URL = 'https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard/releases';
const REVISION = import.meta.env.VITE_APP_REVISION || 'local';

/** A quiet signature at the foot of every page, with the version that is live (linked to its release notes). */
export function Footer() {
  return (
    <footer className="v3-footer">
      <span>Built by <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer">Anuja Jayasinghe</a></span>
      <a className="v3-footer-version" href={`${RELEASES_URL}/tag/v${APP_VERSION}`} target="_blank" rel="noopener noreferrer" title="Release notes for this version">
        {`v${APP_VERSION} · ${REVISION}`}<span className="v3-sr"> release notes</span>
      </a>
      <a className="v3-footer-icon" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="Anuja Jayasinghe on GitHub"><Github size={15} aria-hidden="true" /></a>
    </footer>
  );
}
