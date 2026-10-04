import { createContext, useContext } from 'react';

// What the rest of the app sees. `level` is 'loading' until Clerk has resolved the session.
// Without a Clerk key (local dev, or a build without auth) everyone is a visitor on the demo.
export const VISITOR = Object.freeze({ level: 'none', userId: null, email: null, getToken: async () => null, signIn: null, signOut: null });
export const AccessContext = createContext(VISITOR);

export function useAccess() {
  return useContext(AccessContext);
}
