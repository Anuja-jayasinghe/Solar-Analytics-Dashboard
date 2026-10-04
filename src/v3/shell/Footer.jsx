import { Github } from 'lucide-react';

export const PORTFOLIO_URL = 'https://anujajay.com';
export const GITHUB_URL = 'https://github.com/Anuja-jayasinghe';

/** A quiet signature at the foot of every page. */
export function Footer() {
  return (
    <footer className="v3-footer">
      <span>Built by <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer">Anuja Jayasinghe</a></span>
      <a className="v3-footer-icon" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="Anuja Jayasinghe on GitHub"><Github size={15} aria-hidden="true" /></a>
    </footer>
  );
}
