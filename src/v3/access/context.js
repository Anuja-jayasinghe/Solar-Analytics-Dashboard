import { createContext, useContext } from 'react';

// What the rest of the app sees. `level` is 'loading' until Clerk has resolved the session.
// Without a Clerk key (local dev, or a build without auth) everyone is a visitor on the demo.
//   clerk:        true when Clerk is configured (the sign-in page embeds Clerk's own form)
//   profile:      { nickname, avatar } chosen by the person (see avatars.js)
//   saveProfile:  persists it (Clerk user metadata when signed in, this browser otherwise)
export const VISITOR = Object.freeze({
  level: 'none', userId: null, email: null, firstName: null, clerk: false,
  profile: { nickname: '', avatar: 'initial' },
  getToken: async () => null, signOut: null, saveProfile: async () => {}
});
export const AccessContext = createContext(VISITOR);

export function useAccess() {
  return useContext(AccessContext);
}
