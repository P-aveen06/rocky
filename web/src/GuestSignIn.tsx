import { useState, type FormEvent } from "react";

import studyingIllustration from "./assets/blush/studying.png";
import { CheckIcon } from "./icons";
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
    <section className="guest-access" aria-labelledby="guest-title">
      <div className="guest-access__story">
        <div className="guest-access__brand">
          <span className="guest-access__brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>
            <strong>Rocky</strong>
            <small>Your interview practice copilot</small>
          </span>
        </div>

        <div className="guest-access__story-copy">
          <p className="section__eyebrow">Private by design</p>
          <h2>Bring the role. Rocky brings the rehearsal plan.</h2>
          <p>
            Turn your résumé and job description into focused interview
            practice, then leave with feedback you can use immediately.
          </p>
          <ul className="guest-access__trust">
            <li>
              <CheckIcon size={16} /> No account or password required
            </li>
            <li>
              <CheckIcon size={16} /> Your sessions stay linked to this email
            </li>
            <li>
              <CheckIcon size={16} /> You control camera and microphone access
            </li>
          </ul>
        </div>

        <div className="guest-access__art">
          <img
            src={studyingIllustration}
            alt="A candidate preparing for an interview at home"
          />
        </div>
      </div>

      <div className="guest-access__form-panel">
        <p className="section__eyebrow">Guest access</p>
        <h1 id="guest-title">Tell us who you are</h1>
        <p className="guest-access__lede">
          No password. Your name and email reconnect you with the same Rocky
          workspace when you return.
        </p>
        <form className="guest-form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">Your name</span>
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
            <span className="field__label">Email</span>
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
            className="btn btn--primary guest-access__submit"
            type="submit"
            disabled={working || !fullName.trim() || !email.trim()}
          >
            <span>{working ? "Starting…" : "Start practising"}</span>
            <span aria-hidden="true">→</span>
          </button>
          <p className="guest-access__privacy">
            Your email is used to reconnect this guest workspace.
          </p>
          {onCancel ? (
            <button className="btn btn--ghost" type="button" onClick={onCancel}>
              Sign in instead
            </button>
          ) : null}
        </form>
      </div>
    </section>
  );
}
