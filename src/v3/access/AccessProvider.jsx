import { useEffect, useMemo, useState } from 'react';
import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { levelForUser, signedOutHint } from './level.js';
import { AccessContext, VISITOR } from './context.js';

// If Clerk cannot load (wrong domain on a preview, offline, blocked) the app must still open on the demo.
const CLERK_TIMEOUT_MS = 5000;

function ClerkAccess({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const clerk = useClerk();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (isLoaded) return undefined;
    const t = setTimeout(() => setGaveUp(true), CLERK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isLoaded]);
  const [hintSignedOut] = useState(() => (typeof document !== 'undefined' ? signedOutHint(document.cookie) : false));
  const level = levelForUser({ isLoaded, isSignedIn, publicMetadata: user?.publicMetadata, gaveUp, hintSignedOut });
  const value = useMemo(
    () => ({
      level,
      userId: user?.id ?? null,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      getToken: () => getToken(),
      signIn: !isLoaded ? null : () => clerk.openSignIn({ forceRedirectUrl: '/', fallbackRedirectUrl: '/' }),
      signOut: () => clerk.signOut({ redirectUrl: '/' })
    }),
    [level, user, getToken, clerk, isLoaded]
  );
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function AccessProvider({ children }) {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) return <AccessContext.Provider value={VISITOR}>{children}</AccessContext.Provider>;
  return (
    <ClerkProvider publishableKey={key}>
      <ClerkAccess>{children}</ClerkAccess>
    </ClerkProvider>
  );
}
