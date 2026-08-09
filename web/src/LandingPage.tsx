import type { ReactNode } from "react";

import analyticsIllustration from "./assets/blush/analytics.png";
import businessPlanningIllustration from "./assets/blush/business-planning.png";
import checkIllustration from "./assets/blush/check.png";
import onlineMeetingIllustration from "./assets/blush/online-meeting.png";
import paperworkIllustration from "./assets/blush/paperwork.png";
import processIllustration from "./assets/blush/process.png";
import studyingIllustration from "./assets/blush/studying.png";
import videoCallIllustration from "./assets/blush/video-call.png";
import { CheckIcon, ClockIcon, FileIcon, PlayIcon } from "./icons";

interface LandingPageProps {
  onOpenWorkspace: () => void;
}

interface WorkflowStepProps {
  number: string;
  title: string;
  body: string;
  illustration: string;
}

interface AudienceCardProps {
  index: string;
  title: string;
  body: string;
  note: string;
}

interface PrincipleProps {
  icon: ReactNode;
  title: string;
  body: string;
}

const demoVideoUrl: string | null = null;

const journey = [
  {
    time: "Hour 00—02",
    title: "Start with the real problem",
    body: "Interview preparation felt generic, stressful, and disconnected from the role. Rocky began with one premise: useful practice must understand both the candidate and the job.",
  },
  {
    time: "Hour 02—05",
    title: "Turn experience into evidence",
    body: "Résumé claims and the job description became a source-backed profile and an editable scorecard—so every question has a reason to exist.",
  },
  {
    time: "Hour 05—08",
    title: "Build the live practice room",
    body: "Voice and quiet-room text modes created a realistic interview loop, with preflight checks and recovery paths for the moments technology gets in the way.",
  },
  {
    time: "Hour 08—12",
    title: "Make the transcript dependable",
    body: "Live transcription gives immediate feedback; a second, higher-accuracy pass reconciles each answer without storing raw answer audio.",
  },
  {
    time: "Hour 12—15",
    title: "Report evidence, not vibes",
    body: "Answers are evaluated against the frozen scorecard. Strengths, gaps, uncertainty, transcript excerpts, and practice drills stay traceable—and export as a standalone HTML report.",
  },
  {
    time: "Hour 15—18",
    title: "Rocky gets a name and a face",
    body: "Inspired by Project Hail Mary, Rocky became the calm copilot that helps solve the next interview problem. A warm, illustrated rehearsal studio replaced the generic dashboard.",
  },
  {
    time: "Hour 18—20",
    title: "Refine the whole journey",
    body: "First-use guidance, compact navigation, mobile layouts, privacy controls, illustrated reports, and a full validation pass turned a hackathon idea into a coherent working product.",
  },
];

function Brand() {
  return (
    <span className="landing-brand">
      <span className="studio-brand__mark" aria-hidden="true">
        <span />
      </span>
      <span>
        <strong>Rocky</strong>
        <small>Live interview preparation</small>
      </span>
    </span>
  );
}

function DemoLink({ className = "" }: { className?: string }) {
  const sharedClassName = `btn landing-demo-link ${className}`.trim();
  if (demoVideoUrl) {
    return (
      <a
        className={sharedClassName}
        href={demoVideoUrl}
        target="_blank"
        rel="noreferrer"
      >
        <PlayIcon size={18} /> Watch demo
      </a>
    );
  }
  return (
    <a className={sharedClassName} href="#demo-video">
      <PlayIcon size={18} /> Watch demo
    </a>
  );
}

function WorkflowStep({
  number,
  title,
  body,
  illustration,
}: WorkflowStepProps) {
  return (
    <article className="landing-workflow-card">
      <div className="landing-workflow-card__header">
        <span>{number}</span>
        <img src={illustration} alt="" aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function AudienceCard({ index, title, body, note }: AudienceCardProps) {
  return (
    <article className="landing-audience-card">
      <span>{index}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <small>{note}</small>
    </article>
  );
}

function Principle({ icon, title, body }: PrincipleProps) {
  return (
    <article className="landing-principle">
      <span aria-hidden="true">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </article>
  );
}

export function LandingPage({ onOpenWorkspace }: LandingPageProps) {
  return (
    <div className="landing-page" id="top">
      <header className="landing-topbar">
        <a href="#top" aria-label="Rocky home">
          <Brand />
        </a>
        <nav aria-label="Landing page">
          <a href="#how-it-works">How it works</a>
          <a href="#who-it-is-for">Who it’s for</a>
          <a href="#journey">Journey</a>
        </nav>
        <div className="landing-topbar__actions">
          <DemoLink className="btn--ghost" />
          <button
            className="btn btn--primary"
            type="button"
            onClick={onOpenWorkspace}
          >
            Open Rocky <span aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      <main>
        <section
          className="landing-shell landing-hero"
          aria-labelledby="hero-title"
        >
          <div className="landing-hero__copy">
            <p className="landing-eyebrow">
              Role-aware · evidence-backed · built in a 20-hour hackathon
            </p>
            <h1 id="hero-title">
              Practice for the interview you actually want.
            </h1>
            <p className="landing-hero__lede">
              Rocky turns your résumé and target role into a realistic live
              interview, then shows exactly what your answers proved—and what to
              practise next.
            </p>
            <div className="landing-hero__actions">
              <button
                className="btn btn--primary"
                type="button"
                onClick={onOpenWorkspace}
              >
                Start practising <span aria-hidden="true">→</span>
              </button>
              <DemoLink />
            </div>
            <ul className="landing-checklist" aria-label="Rocky highlights">
              <li>
                <CheckIcon size={16} /> Grounded in your résumé and job
                description
              </li>
              <li>
                <CheckIcon size={16} /> Voice or distraction-free text practice
              </li>
              <li>
                <CheckIcon size={16} /> Downloadable evidence report
              </li>
            </ul>
          </div>

          <div className="landing-hero__visual">
            <div className="landing-note landing-note--top">
              <span>Today’s focus</span>
              <strong>Make the trade-off visible.</strong>
            </div>
            <div className="landing-hero__frame">
              <div className="landing-hero__frame-bar" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <img
                src={onlineMeetingIllustration}
                alt="Two people preparing together for an online interview"
              />
            </div>
            <div className="landing-note landing-note--bottom">
              <span>Rocky’s rule</span>
              <strong>Evidence, not vibes.</strong>
            </div>
          </div>
        </section>

        <section className="landing-proof" aria-label="Product principles">
          <div className="landing-shell">
            <span>Résumé-aware</span>
            <span>Role-specific</span>
            <span>Realtime practice</span>
            <span>Private by design</span>
            <span>Actionable reports</span>
          </div>
        </section>

        <section
          className="landing-shell landing-problem"
          aria-labelledby="problem-title"
        >
          <div className="landing-section-intro">
            <p className="landing-eyebrow">Why Rocky</p>
            <h2 id="problem-title">
              Generic questions create generic confidence.
            </h2>
          </div>
          <div className="landing-problem__body">
            <p>
              Interviews are not only about remembering an answer. They are
              about selecting the right story, showing your part clearly, and
              connecting your evidence to what the role actually needs.
            </p>
            <blockquote>
              Rocky helps you practise the story—not memorise the script.
            </blockquote>
          </div>
        </section>

        <section
          className="landing-section landing-section--sunken"
          id="how-it-works"
        >
          <div className="landing-shell">
            <div className="landing-section-intro landing-section-intro--wide">
              <p className="landing-eyebrow">One connected practice loop</p>
              <h2>From your experience to your next sharper answer.</h2>
              <p>
                Every stage keeps the interview tied to observable evidence,
                while still feeling calm enough to practise repeatedly.
              </p>
            </div>
            <div className="landing-workflow-grid">
              <WorkflowStep
                number="01"
                title="Bring your context"
                body="Upload a résumé and add the job description. Rocky keeps source references attached to the claims it extracts."
                illustration={paperworkIllustration}
              />
              <WorkflowStep
                number="02"
                title="Shape the scorecard"
                body="Review the role-specific competencies, priorities, and evidence the interview should collect."
                illustration={businessPlanningIllustration}
              />
              <WorkflowStep
                number="03"
                title="Practise live"
                body="Answer by voice or text in a focused room with realistic follow-ups, recovery, and transcript visibility."
                illustration={videoCallIllustration}
              />
              <WorkflowStep
                number="04"
                title="Reflect with evidence"
                body="See strengths, gaps, transcript excerpts, uncertainty, and drills—then download the report as HTML."
                illustration={analyticsIllustration}
              />
            </div>
          </div>
        </section>

        <section
          className="landing-shell landing-audience"
          id="who-it-is-for"
          aria-labelledby="audience-title"
        >
          <div className="landing-audience__intro">
            <div className="landing-section-intro">
              <p className="landing-eyebrow">
                Built for more than one career stage
              </p>
              <h2 id="audience-title">
                A practice room for anyone preparing to be understood.
              </h2>
              <p>
                The use case is intentionally wide: first interviews, next
                roles, career changes, placement preparation, and structured
                coaching programmes.
              </p>
            </div>
            <img
              src={studyingIllustration}
              alt="A learner preparing thoughtfully at a desk"
            />
          </div>
          <div className="landing-audience-grid">
            <AudienceCard
              index="01"
              title="Students & freshers"
              body="Turn coursework, internships, projects, and placements into clear stories—even when professional experience is limited."
              note="First roles · campus placements · internships"
            />
            <AudienceCard
              index="02"
              title="Working professionals"
              body="Prepare for a specific company or promotion without relying on generic interview question lists."
              note="Job switches · promotions · leadership rounds"
            />
            <AudienceCard
              index="03"
              title="Career switchers & returners"
              body="Translate existing experience into the language of a new role and identify where the evidence still needs strengthening."
              note="Role changes · returning to work · new industries"
            />
            <AudienceCard
              index="04"
              title="Trainers & placement teams"
              body="Give freshers a repeatable practice structure and a report that supports focused, evidence-based coaching."
              note="Bootcamps · colleges · mentors · L&D teams"
            />
          </div>
        </section>

        <section
          className="landing-section landing-demo"
          id="demo-video"
          aria-labelledby="demo-title"
        >
          <div className="landing-shell landing-demo__grid">
            <div>
              <p className="landing-eyebrow">Product walkthrough</p>
              <h2 id="demo-title">See the complete practice loop.</h2>
              <p>
                A short demo will be added here shortly—from résumé setup to the
                live interview and downloadable evidence report.
              </p>
              <span className="landing-demo__status">
                <ClockIcon size={16} /> Demo video coming soon
              </span>
            </div>
            <div
              className="landing-video-placeholder"
              aria-label="Demo video placeholder"
            >
              <img
                src={videoCallIllustration}
                alt="An illustrated video call interface"
              />
              <span
                className="landing-video-placeholder__play"
                aria-hidden="true"
              >
                <PlayIcon size={24} />
              </span>
              <small>Rocky product demo</small>
            </div>
          </div>
        </section>

        <section
          className="landing-shell landing-journey"
          id="journey"
          aria-labelledby="journey-title"
        >
          <div className="landing-journey__intro">
            <div className="landing-section-intro">
              <p className="landing-eyebrow">
                Hackathon log · the first 20 hours
              </p>
              <h2 id="journey-title">The Journey of Rocky</h2>
              <p>
                Twenty hours of turning a broad need—help people practise
                interviews meaningfully—into a product with a working end-to-end
                experience.
              </p>
            </div>
            <div className="landing-journey__art">
              <img
                src={processIllustration}
                alt="A builder turning an idea into a working process"
              />
              <span>20 hours · 1 connected mission</span>
            </div>
          </div>

          <ol className="landing-timeline">
            {journey.map((item) => (
              <li key={item.time}>
                <span>{item.time}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="landing-section landing-section--sunken"
          aria-labelledby="principles-title"
        >
          <div className="landing-shell">
            <div className="landing-section-intro landing-section-intro--wide">
              <p className="landing-eyebrow">The product promises</p>
              <h2 id="principles-title">
                Supportive coaching, with clear boundaries.
              </h2>
            </div>
            <div className="landing-principles-grid">
              <Principle
                icon={<FileIcon size={20} />}
                title="Evidence stays traceable"
                body="Coaching claims point back to the résumé, job description, scorecard, or words used in the interview."
              />
              <Principle
                icon={<CheckIcon size={20} />}
                title="Speaking stays separate"
                body="Optional delivery coaching never changes the evidence score and never claims to infer personality or honesty."
              />
              <Principle
                icon={<ClockIcon size={20} />}
                title="Practice remains recoverable"
                body="Drafts, connection recovery, transcript finalisation, deletion, and privacy are designed as product states—not afterthoughts."
              />
            </div>
          </div>
        </section>

        <section
          className="landing-shell landing-final-cta"
          aria-labelledby="final-cta-title"
        >
          <div>
            <p className="landing-eyebrow">Your next answer can be sharper</p>
            <h2 id="final-cta-title">
              Bring the role. Bring your experience. Rocky will help you
              rehearse the connection.
            </h2>
            <div className="landing-hero__actions">
              <button
                className="btn btn--primary"
                type="button"
                onClick={onOpenWorkspace}
              >
                Open Rocky <span aria-hidden="true">→</span>
              </button>
              <DemoLink />
            </div>
          </div>
          <img src={checkIllustration} alt="A completed practice checklist" />
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell">
          <Brand />
          <p>
            Built during a 20-hour hackathon to make interview preparation more
            specific, safe, and useful.
          </p>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={onOpenWorkspace}
          >
            Open workspace →
          </button>
        </div>
      </footer>
    </div>
  );
}
