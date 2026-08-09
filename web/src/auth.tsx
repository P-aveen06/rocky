import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import { useEffect, useState, type ReactNode } from "react";

import { setAuthTokenProvider } from "./api";
import { clerkEnabled, clerkPublishableKey } from "./authConfig";

function TokenBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthTokenProvider(() => getToken());
    setReady(true);
    return () => setAuthTokenProvider(null);
  }, [getToken]);

  // Holding the first render back until the provider is registered keeps the
  // app's initial data load from firing an unauthenticated request.
  if (!isLoaded || !ready) return null;
  return <>{children}</>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  if (!clerkEnabled) return <>{children}</>;

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      afterSignOutUrl="/"
      // Clerk posts usage telemetry to clerk-telemetry.com, a third origin the
      // CSP does not allow. Turning it off is preferable to widening the policy
      // for analytics the app does not need.
      telemetry={{ disabled: true }}
    >
      <SignedOut>
        <main className="auth-page">
          <SignIn routing="hash" />
        </main>
      </SignedOut>
      <SignedIn>
        <TokenBridge>{children}</TokenBridge>
      </SignedIn>
    </ClerkProvider>
  );
}

/** Clerk's account menu, or nothing at all when running without Clerk. */
export function AccountButton() {
  if (!clerkEnabled) return null;
  return <UserButton afterSignOutUrl="/" />;
}
