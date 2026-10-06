// Solar Crew portraits are arranged in four seven-character sheets under public/avatars/.
// The original icon IDs stay readable so an existing choice keeps its meaning after the upgrade.

export const AVATAR_GROUPS = Object.freeze([
  { id: 'sky', label: 'Sky & Sun', avatars: [
    ['sol', 'Sol'], ['cirrus', 'Cirrus'], ['ray', 'Ray'], ['dawn', 'Dawn'],
    ['zephyr', 'Zephyr'], ['nimbus', 'Nimbus'], ['aurora', 'Aurora']
  ] },
  { id: 'space', label: 'Night & Space', avatars: [
    ['luna', 'Luna'], ['orbit', 'Orbit'], ['comet', 'Comet'], ['vesper', 'Vesper'],
    ['cosmo', 'Cosmo'], ['meteor', 'Meteor'], ['stella', 'Stella']
  ] },
  { id: 'tech', label: 'Tech & Energy', avatars: [
    ['nova', 'Nova'], ['volt', 'Volt'], ['amp', 'Amp'], ['pixel', 'Pixel'],
    ['prism', 'Prism'], ['circuit', 'Circuit'], ['sprocket', 'Sprocket']
  ] },
  { id: 'nature', label: 'Earth & Nature', avatars: [
    ['terra', 'Terra'], ['ember', 'Ember'], ['moss', 'Moss'], ['coral', 'Coral'],
    ['bloom', 'Bloom'], ['tide', 'Tide'], ['fern', 'Fern']
  ] }
]);

export const AVATARS = Object.freeze(AVATAR_GROUPS.flatMap((group) =>
  group.avatars.map(([id, label], index) => Object.freeze({
    id, label, sheet: group.id, column: index % 4, row: Math.floor(index / 4)
  }))
));

export const FEATURED_AVATAR_IDS = Object.freeze(['sol', 'nova', 'volt', 'cirrus', 'luna', 'terra', 'orbit', 'ember']);
export const NICKNAME_MAX = 24;

const LEGACY_AVATARS = Object.freeze({
  sun: 'sol', bolt: 'volt', panel: 'nova', leaf: 'terra',
  moon: 'luna', cloud: 'cirrus', mountain: 'fern', star: 'stella'
});
const INITIAL = Object.freeze({ id: 'initial', label: 'Initial', sheet: null });

/** A stored choice, including old icon IDs. Null means no Solar Crew choice has been made. */
export function savedAvatarId(id) {
  const current = LEGACY_AVATARS[id] ?? id;
  return AVATARS.find((avatar) => avatar.id === current)?.id ?? null;
}

export function avatarById(id) {
  return AVATARS.find((avatar) => avatar.id === savedAvatarId(id)) ?? INITIAL;
}

/** A new signed-in profile gets one random character; only a valid saved choice suppresses assignment. */
export function randomAvatarId(random = Math.random) {
  const index = Math.min(AVATARS.length - 1, Math.floor(random() * AVATARS.length));
  return AVATARS[index].id;
}

/** Assign once to an account without replacing a saved selection or other user metadata. */
export async function assignMissingAvatar(user, random = Math.random) {
  const saved = savedAvatarId(user.unsafeMetadata?.profile?.avatar);
  if (saved) return saved;
  const avatar = randomAvatarId(random);
  await user.update({
    unsafeMetadata: {
      ...(user.unsafeMetadata ?? {}),
      profile: normalizeProfile({ ...(user.unsafeMetadata?.profile ?? {}), avatar })
    }
  });
  return avatar;
}

/** These coordinates crop the illustrated portraits, leaving the sheet labels outside the circle. */
export function portraitStyle(avatar, size) {
  const scale = size / 352;
  const left = [38, 402, 772, 1142][avatar.column];
  const top = avatar.row === 0 ? 50 : 502;
  return { width: 1536 * scale, maxWidth: 'none', left: -left * scale, top: -top * scale };
}

/** Trimmed, single-spaced, at most NICKNAME_MAX characters; empty means "no nickname". */
export function cleanNickname(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
}

/** What to call the person: nickname, else first name, else the part of the email before @, else the role. */
export function displayNameFor({ nickname, firstName, email, fallback }) {
  return cleanNickname(nickname) || (firstName ?? '').trim() || (email ? String(email).split('@')[0] : '') || fallback;
}

/** The letter shown while no character has been assigned. */
export function initialOf(name) {
  const c = String(name ?? '').trim().charAt(0);
  return c ? c.toUpperCase() : '?';
}

/** A stored profile (from Clerk's unsafeMetadata or the browser) -> a safe one. */
export function normalizeProfile(raw) {
  return { nickname: cleanNickname(raw?.nickname), avatar: savedAvatarId(raw?.avatar) ?? 'initial' };
}
