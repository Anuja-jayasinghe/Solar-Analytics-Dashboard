import { usePrefs } from '../prefs/context.js';
import { Icon } from '../shell/icons.jsx';

/** Shows or hides the "Mark above" line on every chart (remembered in this browser). */
export function MarkToggle() {
  const { showMark, setShowMark } = usePrefs();
  return (
    <button type="button" className="v3-btn v3-marktoggle" aria-pressed={showMark} onClick={() => setShowMark(!showMark)} aria-label={showMark ? 'Hide the Mark above line' : 'Show the Mark above line'}>
      <Icon id={showMark ? 'eye' : 'eyeOff'} size={15} />
      <span>{showMark ? 'Mark above' : 'Mark above: hidden'}</span>
    </button>
  );
}
