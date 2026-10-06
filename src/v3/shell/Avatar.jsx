import { avatarById, initialOf, portraitStyle } from '../access/avatars.js';

/** A cropped Solar Crew portrait, with an initial only while no character is assigned. */
export function Avatar({ avatar, name, size = 34 }) {
  const a = avatarById(avatar);
  return (
    <span className="v3-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {a.sheet
        ? <img className="v3-avatar-art" src={`/avatars/solar-crew-${a.sheet}.webp`} style={portraitStyle(a, size)} alt="" draggable="false" />
        : initialOf(name)}
    </span>
  );
}
