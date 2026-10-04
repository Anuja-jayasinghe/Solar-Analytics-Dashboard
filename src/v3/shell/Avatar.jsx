import { avatarById, initialOf } from '../access/avatars.js';
import { Icon } from './icons.jsx';

/** The profile bubble: a preset icon on a tinted disc, or the first letter of the name. */
export function Avatar({ avatar, name, size = 34 }) {
  const a = avatarById(avatar);
  return (
    <span className="v3-avatar" data-tone={a.tone} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {a.icon ? <Icon id={a.icon} size={Math.round(size * 0.55)} /> : initialOf(name)}
    </span>
  );
}
