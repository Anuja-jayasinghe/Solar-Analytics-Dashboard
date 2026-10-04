import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { levelForUser, signedOutHint } from './level.js';
import { AccessContext, VISITOR } from './context.js';
import { normalizeProfile } from './avatars.js';
import { readPref, writePref } from '../theme/storage.js';

// If Clerk cannot load (wrong domain on a preview, offline, blocked) the app must still open on the demo.
const CLERK_TIMEOUT_MS = 5000;

/** A visitor's nickname/avatar, kept in this browser only. */
function useLocalProfile() {
  const [profile, setProfile] = useState(() => {
    try { return normalizeProfile(JSON.parse(readPref('profile', '{}'))); } catch { return normalizeProfile({}); }
  });
  const save = useCallback(async (next) => {
    const p = normalizeProfile(next);
    setProfile(p);
    writePref('profile', JSON.stringify(p));
  }, []);
  return [profile, save];
}

function ClerkAccess({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const clerk = useClerk();
  const [localProfile, saveLocal] = useLocalProfile();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (isLoaded) return undefined;
    const t = setTimeout(() => setGaveUp(true), CLERK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isLoaded]);
  const [hintSignedOut] = useState(() => (typeof document !== 'undefined' ? signedOutHint(document.cookie) : false));
  const level = levelForUser({ isLoaded, isSignedIn, publicMetadata: user?.publicMetadata, gaveUp, hintSignedOut });

  // Signed in: the profile lives on the Clerk user (unsafeMetadata is user-editable and holds nothing sensitive),
  // so it follows the person across devices. Signed out: this browser.
  const profile = isSignedIn && user ? normalizeProfile(user.unsafeMetadata?.profile) : localProfile;
  const saveProfile = useCallback(async (next) => {
    if (isSignedIn && user) {
      await user.update({ unsafeMetadata: { ...(user.unsafeMetadata ?? {}), profile: normalizeProfile(next) } });
    } else {
      await saveLocal(next);
    }
  }, [isSignedIn, user, saveLocal]);

  const value = useMemo(
    () => ({
      level,
      userId: user?.id ?? null,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      firstName: user?.firstName ?? null,
      clerk: true,
      profile,
      saveProfile,
      getToken: () => getToken(),
      signOut: () => clerk.signOut({ redirectUrl: '/' })
    }),
    [level, user, getToken, clerk, profile, saveProfile]
  );
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

function LocalAccess({ children }) {
  const [profile, saveProfile] = useLocalProfile();
  const value = useMemo(() => ({ ...VISITOR, profile, saveProfile }), [profile, saveProfile]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function AccessProvider({ children }) {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) return <LocalAccess>{children}</LocalAccess>;
  return (
    <ClerkProvider publishableKey={key} signInUrl="/signin" signUpUrl="/signup" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
      <ClerkAccess>{children}</ClerkAccess>
    </ClerkProvider>
  );
}
