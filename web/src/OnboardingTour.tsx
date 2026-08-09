import { useState } from "react";

import analyticsIllustration from "./assets/blush/analytics.png";
import paperworkIllustration from "./assets/blush/paperwork.png";
import studyingIllustration from "./assets/blush/studying.png";
import videoCallIllustration from "./assets/blush/video-call.png";

interface OnboardingTourProps {
  onComplete: () => void;
}

const steps = [
  {
    eyebrow: "Welcome aboard",
    title: "Meet Rocky, your interview practice copilot.",
    body: "Rocky turns your résumé and a real job description into focused, private interview practice.",
    image: studyingIllustration,
    alt: "A candidate preparing for an interview",
  },
  {
    eyebrow: "Step one",
    title: "Build an evidence-backed profile.",
    body: "Add your résumé and target role. Rocky keeps every coaching claim connected to the source material you provided.",
    image: paperworkIllustration,
    alt: "A candidate organizing résumé evidence",
  },
  {
    eyebrow: "Step two",
    title: "Practice in a distraction-free room.",
    body: "Choose voice or developer text mode, rehearse naturally, and let Rocky collect the evidence demonstrated in each answer.",
    image: videoCallIllustration,
    alt: "A candidate preparing for an online interview",
  },
  {
    eyebrow: "Step three",
    title: "Review, improve, and take the report with you.",
    body: "Open the report from its practice-session row, review the gaps and exercises, then download a standalone HTML copy.",
    image: analyticsIllustration,
    alt: "A coach reviewing an interview report",
  },
] as const;

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div className="onboarding-backdrop">
      <section
        className="onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-body"
      >
        <header className="onboarding-dialog__topbar">
          <span>
            {stepIndex + 1} of {steps.length}
          </span>
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={onComplete}
          >
            Skip tour
          </button>
        </header>

        <div className="onboarding-dialog__content">
          <div className="onboarding-dialog__art">
            <img src={step.image} alt={step.alt} />
          </div>
          <div className="onboarding-dialog__copy">
            <p className="section__eyebrow">{step.eyebrow}</p>
            <h2 id="onboarding-title">{step.title}</h2>
            <p id="onboarding-body">{step.body}</p>
          </div>
        </div>

        <footer className="onboarding-dialog__footer">
          <div className="onboarding-progress" aria-label="Tour progress">
            {steps.map((item, index) => (
              <span
                className={index === stepIndex ? "is-active" : ""}
                aria-current={index === stepIndex ? "step" : undefined}
                key={item.title}
              />
            ))}
          </div>
          <div>
            {stepIndex > 0 ? (
              <button
                className="btn"
                type="button"
                onClick={() => setStepIndex((current) => current - 1)}
              >
                Back
              </button>
            ) : null}
            <button
              className="btn btn--primary"
              type="button"
              onClick={() =>
                isLastStep
                  ? onComplete()
                  : setStepIndex((current) => current + 1)
              }
            >
              {isLastStep ? "Start with Rocky" : "Next"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
