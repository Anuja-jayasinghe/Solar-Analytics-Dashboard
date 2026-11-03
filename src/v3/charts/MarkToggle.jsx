import { usePrefs } from '../prefs/context.js';
import { Icon } from '../shell/icons.jsx';

/** Shows or hides the "Mark above" line on every chart (remembered in this browser). Just the eye; the name is in the tooltip. */
export function MarkToggle() {
  const { showMark, setShowMark } = usePrefs();
  return (
    <button type="button" className="v3-iconbtn v3-marktoggle" aria-pressed={showMark} onClick={() => setShowMark(!showMark)} aria-label={showMark ? 'Hide the Mark above line' : 'Show the Mark above line'} title={showMark ? 'Hide the Mark above line' : 'Show the Mark above line'}>
      <Icon id={showMark ? 'eye' : 'eyeOff'} size={15} />
    </button>
  );
}
