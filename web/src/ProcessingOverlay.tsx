import { useEffect, useMemo, useState } from "react";

import { CheckIcon } from "./icons";
import { shuffledTips } from "./tips";

interface ProcessingOverlayProps {
  title: string;
  lede: string;
  /** Ordered work the step performs, shown as a progressing checklist. */
  phases: string[];
  /** Seconds each phase is expected to take before the next one lights up. */
  phaseSeconds?: number;
  tipSeconds?: number;
}

/**
 * Full-canvas busy state for the setup steps that call the model.
 *
 * Extraction and scorecard generation take long enough that a disabled button
 * with "Extracting…" reads as a hang, so the wait gets a phase checklist for
 * progress and a rotating interview tip so the time is not wasted.
 */
export function ProcessingOverlay({
  title,
  lede,
  phases,
  phaseSeconds = 5,
  tipSeconds = 7,
}: ProcessingOverlayProps) {
  const tips = useMemo(() => shuffledTips(), []);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // The last phase never self-completes: it stays active until the request
  // resolves and the overlay unmounts, so the checklist can't claim to be done
  // while work is still running.
  const activePhase = Math.min(
    Math.floor(elapsed / phaseSeconds),
    phases.length - 1,
  );
  const tip = tips[Math.floor(elapsed / tipSeconds) % tips.length];

  return (
    <div className="processing-overlay" role="status" aria-live="polite">
      <div className="card processing-card">
        <div className="processing-card__header">
          <span className="processing-spinner" aria-hidden="true" />
          <div>
            <h2>{title}</h2>
            <p>{lede}</p>
          </div>
        </div>

        <ol className="processing-phases">
          {phases.map((phase, index) => {
            const state =
              index < activePhase
                ? "is-done"
                : index === activePhase
                  ? "is-active"
                  : "is-pending";
            return (
              <li className={`processing-phase ${state}`} key={phase}>
                <span className="processing-phase__marker" aria-hidden="true">
                  {index < activePhase ? <CheckIcon size={14} /> : null}
                </span>
                <span>{phase}</span>
              </li>
            );
          })}
        </ol>

        <div className="processing-tip">
          <p className="processing-tip__eyebrow">While you wait</p>
          <strong key={tip.title} className="processing-tip__title">
            {tip.title}
          </strong>
          <p className="processing-tip__body">{tip.body}</p>
        </div>
      </div>
    </div>
  );
}
