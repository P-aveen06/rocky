import { useState, type FormEvent } from "react";

import { startGuestSession, type GuestSession } from "./guestSession";

interface GuestSignInProps {
  onStarted: (session: GuestSession) => void;
  onCancel?: () => void;
}

/** Name and email, no password and no sign-up. */
export function GuestSignIn({ onStarted, onCancel }: GuestSignInProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      onStarted(await startGuestSession(fullName.trim(), email.trim()));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The guest session could not be started.",
      );
      setWorking(false);
    }
  }

  return (
    <section className="card auth-card" aria-labelledby="guest-title">
      <div className="topbar__brand auth-card__brand">
        <div className="topbar__brand-mark" aria-hidden="true">
          R
        </div>
        <span>Rocky</span>
      </div>
      <p className="section__eyebrow">Guest access</p>
      <h1 id="guest-title">Tell us who you are</h1>
      <p className="section__lede">
        No account needed. Your name and email keep your practice sessions
        together, so you can come back to them with the same address.
      </p>
      <form className="guest-form" onSubmit={submit}>
        <label className="field">
          <span>Your name</span>
          <input
            className="input"
            type="text"
            value={fullName}
            required
            maxLength={160}
            autoComplete="name"
            placeholder="Alex Kumar"
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            value={email}
            required
            autoComplete="email"
            placeholder="alex@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {error ? (
          <p className="preflight-warning" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="btn btn--primary"
          type="submit"
          disabled={working || !fullName.trim() || !email.trim()}
        >
          {working ? "Starting…" : "Start practising"}
        </button>
        {onCancel ? (
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Sign in instead
          </button>
        ) : null}
      </form>
    </section>
  );
}
