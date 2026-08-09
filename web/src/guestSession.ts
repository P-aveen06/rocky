/**
 * Guest sessions: a name and an email instead of signing up.
 *
 * The token is held in localStorage so closing the tab does not lose the work.
 * Identity is derived server-side from the email, so returning with the same
 * address reopens the same sessions.
 */

const STORAGE_KEY = "interview-coach-guest";

export interface GuestSession {
  token: string;
  expiresAt: string;
  displayName: string;
  email: string;
}

function isLive(session: GuestSession): boolean {
  const expiry = Date.parse(session.expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

export function readGuestSession(): GuestSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as GuestSession;
    if (!session?.token || !isLive(session)) {
      // An expired token would only produce 401s, so clear it rather than
      // leaving the visitor stuck on a broken session.
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function storeGuestSession(session: GuestSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private browsing can refuse storage. The session still works for this
    // tab; it just will not survive a reload.
  }
}

export function clearGuestSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}

export async function startGuestSession(
  fullName: string,
  email: string,
): Promise<GuestSession> {
  const response = await fetch("/api/auth/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ full_name: fullName, email }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      detail?: string;
    };
    throw new Error(
      payload.error?.message ??
        payload.detail ??
        "The guest session could not be started.",
    );
  }
  const body = (await response.json()) as {
    token: string;
    expires_at: string;
    user: { display_name: string; email: string };
  };
  const session: GuestSession = {
    token: body.token,
    expiresAt: body.expires_at,
    displayName: body.user.display_name,
    email: body.user.email,
  };
  storeGuestSession(session);
  return session;
}
