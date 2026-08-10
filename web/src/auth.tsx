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
import { GuestSignIn } from "./GuestSignIn";
import { LogOutIcon } from "./icons";
import {
  clearGuestSession,
  readGuestSession,
  type GuestSession,
} from "./guestSession";

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

/** Serves the stored guest token, and holds render until it is registered. */
function GuestBridge({
  session,
  children,
}: {
  session: GuestSession;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthTokenProvider(async () => session.token);
    setReady(true);
    return () => setAuthTokenProvider(null);
  }, [session.token]);

  if (!ready) return null;
  return <>{children}</>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  // Read once on mount: a stored guest token means this visitor is already in.
  const [guest, setGuest] = useState<GuestSession | null>(readGuestSession);
  const [choosingGuest, setChoosingGuest] = useState(false);
  const [guestOffered, setGuestOffered] = useState<boolean | null>(null);

  // Whether guests are allowed is the server's decision, and the client cannot
  // infer it from its own build.
  useEffect(() => {
    if (guest) return;
    let active = true;
    fetch("/api/capabilities", { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { guest_access_enabled?: boolean } | null) => {
        if (active) setGuestOffered(Boolean(body?.guest_access_enabled));
      })
      .catch(() => {
        if (active) setGuestOffered(false);
      });
    return () => {
      active = false;
    };
  }, [guest]);

  if (guest) {
    return <GuestBridge session={guest}>{children}</GuestBridge>;
  }

  // Without Clerk the app runs on the local identity, unless the server is
  // offering guest access, in which case a visitor should be asked who they are.
  if (!clerkEnabled) {
    if (guestOffered === null) return null;
    if (!guestOffered) return <>{children}</>;
    return (
      <main className="auth-page auth-page--guest">
        <GuestSignIn onStarted={setGuest} />
      </main>
    );
  }

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
        <main
          className={`auth-page ${choosingGuest ? "auth-page--guest" : ""}`}
        >
          {choosingGuest ? (
            <GuestSignIn
              onStarted={setGuest}
              onCancel={() => setChoosingGuest(false)}
            />
          ) : (
            <div className="auth-choice">
              <SignIn routing="hash" />
              {guestOffered ? (
                <div className="auth-choice__alternative">
                  <span>Just want to try it?</span>
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={() => setChoosingGuest(true)}
                  >
                    Continue as guest
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </main>
      </SignedOut>
      <SignedIn>
        <TokenBridge>{children}</TokenBridge>
      </SignedIn>
    </ClerkProvider>
  );
}

/** Account menu for a signed-in user, or a way out for a guest. */
export function AccountButton() {
  const guest = readGuestSession();
  if (guest) {
    return (
      <button
        className="btn btn--ghost btn--small account-button"
        type="button"
        title={guest.email}
        onClick={() => {
          clearGuestSession();
          window.location.reload();
        }}
      >
        <LogOutIcon />
        <span>Leave guest session</span>
      </button>
    );
  }
  if (!clerkEnabled) return null;
  return <UserButton afterSignOutUrl="/" />;
}
