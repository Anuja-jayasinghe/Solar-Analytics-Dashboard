import { createPortal } from 'react-dom';

/**
 * Draws its children in the app's top layer (the themed root, so colour tokens still apply), outside every
 * card. Needed for anything that must escape a card: full-screen dialogs, hint bubbles, date pickers.
 */
export function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  const target = document.querySelector('.v3-root') ?? document.body;
  return createPortal(children, target);
}
