import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError } from "./api";
import { AccountButton } from "./auth";
import { clerkEnabled } from "./authConfig";
import { readGuestSession } from "./guestSession";
import { ConfirmationDialog } from "./ConfirmationDialog";
import {
  BriefcaseIcon,
  ChartIcon,
  CheckIcon,
  ChevronLeftIcon,
  ClockIcon,
  FileIcon,
  HomeIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  TrashIcon,
} from "./icons";
import analyticsIllustration from "./assets/blush/analytics.png";
import onlineMeetingIllustration from "./assets/blush/online-meeting.png";
import paperworkIllustration from "./assets/blush/paperwork.png";
import studyingIllustration from "./assets/blush/studying.png";
import videoCallIllustration from "./assets/blush/video-call.png";
import { OnboardingTour } from "./OnboardingTour";
import { SetupPage } from "./SetupPage";
import { PracticePage } from "./PracticePage";
import { ReportPage } from "./ReportPage";
import { statusPill, statusPillClass } from "./status";
import type { InterviewSession, User } from "./types";

type Theme = "light" | "dark";
type WorkspaceSection = "dashboard" | "sessions" | "progress" | "roles";

const liveStatuses = [
  "CONNECTING",
  "IN_PROGRESS",
  "RECONNECTING",
  "FAILED_RECOVERABLE",
];

/**
 * How far along the practice loop each status sits. The sidebar uses the
 * furthest stage any session has reached to mark loop steps as done, so the
 * navigation reads as a sequence rather than four unrelated destinations.
 */
const SETUP_DONE = 2;
const REHEARSAL_DONE = 4;
const REPORT_DONE = 5;
const flowStage: Record<string, number> = {
  DRAFT: 0,
  PROFILE_READY: 1,
  SCORECARD_READY: SETUP_DONE,
  CONNECTING: 3,
  IN_PROGRESS: 3,
  RECONNECTING: 3,
  FAILED_RECOVERABLE: 3,
  TRANSCRIPT_FINALIZING: REHEARSAL_DONE,
  EVALUATING: REHEARSAL_DONE,
  REPORT_READY: REPORT_DONE,
};
const onboardingStorageKey = "rocky-onboarding-complete";
const sidebarStorageKey = "rocky-sidebar-collapsed";

function initialTheme(): Theme {
  const saved = window.localStorage.getItem("interview-coach-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function initialSidebarCollapsed(): boolean {
  return window.localStorage.getItem(sidebarStorageKey) === "true";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sessionActionLabel(interview: InterviewSession): string {
  if (liveStatuses.includes(interview.status)) return "Resume interview";
  if (["TRANSCRIPT_FINALIZING", "EVALUATING"].includes(interview.status)) {
    return "View progress";
  }
  if (interview.status === "REPORT_READY") return "View report";
  if (interview.status === "SCORECARD_READY") return "Review setup";
  return "Continue setup";
}

export function App() {
  // A guest has no Clerk account, but still needs a way out of the session.
  const guestActive = readGuestSession() !== null;
  const [user, setUser] = useState<User | null>(null);
  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    initialSidebarCollapsed,
  );
  const [selectedInterview, setSelectedInterview] =
    useState<InterviewSession | null>(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [workspaceSection, setWorkspaceSection] =
    useState<WorkspaceSection>("dashboard");
  const [showOnboarding, setShowOnboarding] = useState(
    () => window.localStorage.getItem(onboardingStorageKey) !== "true",
  );
  const [pendingDelete, setPendingDelete] = useState<InterviewSession | null>(
    null,
  );
  const [deletingSession, setDeletingSession] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("interview-coach-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    let active = true;
    Promise.all([api.currentUser(), api.interviews()])
      .then(([currentUser, result]) => {
        if (!active) return;
        setUser(currentUser);
        setInterviews(result.items);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof ApiError
              ? caught
              : new ApiError("The workspace could not be loaded."),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const draftCount = useMemo(
    () =>
      interviews.filter((interview) =>
        ["DRAFT", "PROFILE_READY", "SCORECARD_READY"].includes(
          interview.status,
        ),
      ).length,
    [interviews],
  );
  const reportCount = useMemo(
    () =>
      interviews.filter((interview) => interview.status === "REPORT_READY")
        .length,
    [interviews],
  );
  const furthestStage = useMemo(
    () =>
      interviews.reduce(
        (furthest, interview) =>
          Math.max(furthest, flowStage[interview.status] ?? 0),
        -1,
      ),
    [interviews],
  );

  async function createSession() {
    setCreating(true);
    setError(null);
    try {
      const interview = await api.createInterview();
      setInterviews((current) => [interview, ...current]);
      setSelectedInterview(interview);
      setPracticeMode(false);
      setWorkspaceSection("roles");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError("The practice session could not be created."),
      );
    } finally {
      setCreating(false);
    }
  }

  // Stable identity: child effects depend on this callback, and a new function
  // every render re-ran them on every poll tick.
  const updateInterview = useCallback((updated: InterviewSession) => {
    setInterviews((current) =>
      current.map((interview) =>
        interview.id === updated.id ? updated : interview,
      ),
    );
    setSelectedInterview(updated);
  }, []);

  async function deleteSession() {
    if (!pendingDelete) return;
    setDeletingSession(true);
    setError(null);
    try {
      await api.deleteInterview(pendingDelete.id);
      setInterviews((current) =>
        current.filter((interview) => interview.id !== pendingDelete.id),
      );
      if (selectedInterview?.id === pendingDelete.id) {
        setSelectedInterview(null);
        setPracticeMode(false);
        setWorkspaceSection("sessions");
      }
      setPendingDelete(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError("The practice session could not be deleted."),
      );
    } finally {
      setDeletingSession(false);
    }
  }

  function openInterview(interview: InterviewSession) {
    const opensPractice = liveStatuses.includes(interview.status);
    setSelectedInterview(interview);
    setPracticeMode(opensPractice);
    setWorkspaceSection(
      interview.status === "REPORT_READY" ||
        ["TRANSCRIPT_FINALIZING", "EVALUATING"].includes(interview.status)
        ? "progress"
        : "roles",
    );
  }

  function navigateTo(section: WorkspaceSection, anchorId?: string) {
    setSelectedInterview(null);
    setPracticeMode(false);
    setWorkspaceSection(section);
    if (!anchorId) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document
          .getElementById(anchorId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function openResumeAndRoles() {
    const setupSession = interviews.find((interview) =>
      ["DRAFT", "PROFILE_READY", "SCORECARD_READY"].includes(interview.status),
    );
    if (setupSession) {
      openInterview(setupSession);
      return;
    }
    void createSession();
  }

  function completeOnboarding() {
    window.localStorage.setItem(onboardingStorageKey, "true");
    setShowOnboarding(false);
  }

  const isReportView = Boolean(
    selectedInterview &&
    (["TRANSCRIPT_FINALIZING", "EVALUATING", "REPORT_READY"].includes(
      selectedInterview.status,
    ) ||
      (selectedInterview.status === "FAILED_RECOVERABLE" &&
        selectedInterview.ended_at)),
  );
  const focusMode = Boolean(selectedInterview && practiceMode && !isReportView);
  const nextSession =
    interviews.find((interview) => liveStatuses.includes(interview.status)) ??
    interviews.find((interview) =>
      ["DRAFT", "PROFILE_READY", "SCORECARD_READY"].includes(interview.status),
    );
  const latestReport = interviews.find(
    (interview) => interview.status === "REPORT_READY",
  );
  const activeSection = selectedInterview
    ? isReportView
      ? "progress"
      : "roles"
    : workspaceSection;

  // Ordered to match the loop the landing page promises: bring your context,
  // rehearse it, then read the evidence back. The old order put the entry
  // point last, below its own output.
  const practiceLoop: {
    section: WorkspaceSection;
    step: string;
    label: string;
    icon: ReactNode;
    done: boolean;
    onSelect: () => void;
  }[] = [
    {
      section: "roles",
      step: "01",
      label: "Résumé & roles",
      icon: <BriefcaseIcon />,
      done: furthestStage >= SETUP_DONE,
      onSelect: openResumeAndRoles,
    },
    {
      section: "sessions",
      step: "02",
      label: "Practice sessions",
      icon: <FileIcon />,
      done: furthestStage >= REHEARSAL_DONE,
      onSelect: () => navigateTo("sessions", "practice-sessions"),
    },
    {
      section: "progress",
      step: "03",
      label: "Progress & reports",
      icon: <ChartIcon />,
      done: furthestStage >= REPORT_DONE,
      onSelect: () => navigateTo("progress", "progress-reports"),
    },
  ];

  if (!loading && error?.status === 401) {
    return (
      <main className="auth-page">
        <section className="card auth-card" aria-labelledby="sign-in-title">
          <div className="topbar__brand auth-card__brand">
            <div className="topbar__brand-mark" aria-hidden="true">
              R
            </div>
            <span>Rocky</span>
          </div>
          <p className="section__eyebrow">Private workspace</p>
          <h1 id="sign-in-title">Your session has expired</h1>
          <p className="section__lede">
            Reload the page to sign in again and pick up where you left off.
          </p>
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </section>
      </main>
    );
  }

  return (
    <div
      className={`app-shell ${focusMode ? "app-shell--focus" : ""} ${sidebarCollapsed ? "app-shell--sidebar-collapsed" : ""}`}
    >
      {!focusMode ? (
        <aside
          className={`studio-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}
          aria-label="Workspace navigation"
        >
          <button
            className="studio-brand"
            type="button"
            aria-label="Open dashboard"
            onClick={() => navigateTo("dashboard", "dashboard")}
          >
            <span className="studio-brand__mark" aria-hidden="true">
              <span />
            </span>
            <span className="studio-brand__copy">
              <strong>Rocky</strong>
              <small>Your practice copilot</small>
            </span>
          </button>

          <button
            className="icon-btn studio-sidebar__toggle"
            type="button"
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            <ChevronLeftIcon size={16} />
          </button>

          <nav className="studio-nav" aria-label="Primary">
            <p className="studio-sidebar__label">Workspace</p>
            <button
              className={`studio-nav__item ${activeSection === "dashboard" ? "is-active" : ""}`}
              type="button"
              aria-label="Dashboard"
              aria-current={activeSection === "dashboard" ? "page" : undefined}
              onClick={() => navigateTo("dashboard", "dashboard")}
            >
              <HomeIcon />
              <span>Dashboard</span>
            </button>

            <p className="studio-sidebar__label">Practice loop</p>
            {practiceLoop.map(
              ({ section, step, label, icon, done, onSelect }) => (
                <button
                  key={section}
                  className={`studio-nav__item studio-nav__item--step ${activeSection === section ? "is-active" : ""}`}
                  type="button"
                  aria-label={done ? `${label} (done)` : label}
                  aria-current={activeSection === section ? "page" : undefined}
                  onClick={onSelect}
                >
                  {icon}
                  <span>{label}</span>
                  <span
                    className={`studio-nav__step ${done ? "is-done" : ""}`}
                    aria-hidden="true"
                  >
                    {done ? <CheckIcon size={14} /> : step}
                  </span>
                </button>
              ),
            )}
          </nav>

          <div className="studio-sidebar__footer">
            <div
              className="studio-sidebar__status"
              aria-label="Private workspace"
            >
              <span className="dot dot--online" />
              <span>Private workspace</span>
            </div>
            <div className="studio-sidebar__utilities">
              <button
                className="icon-btn studio-sidebar__theme"
                type="button"
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
                title={`Use ${theme === "light" ? "dark" : "light"} theme`}
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <MoonIcon /> : <SunIcon />}
              </button>
              <div className="studio-sidebar__account">
                {clerkEnabled || guestActive ? (
                  <AccountButton />
                ) : (
                  <div
                    className="avatar"
                    title={user?.email}
                    aria-label="Signed-in user"
                  >
                    {user?.display_name.slice(0, 1).toUpperCase() ?? "…"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {isReportView && selectedInterview ? (
        <ReportPage
          interview={selectedInterview}
          onBack={() => navigateTo("progress", "progress-reports")}
          onInterviewUpdated={updateInterview}
        />
      ) : selectedInterview && practiceMode ? (
        <PracticePage
          interview={selectedInterview}
          onBack={() => {
            setPracticeMode(false);
            setWorkspaceSection("roles");
          }}
          onInterviewUpdated={updateInterview}
        />
      ) : selectedInterview ? (
        <SetupPage
          interview={selectedInterview}
          onBack={() => navigateTo("sessions", "practice-sessions")}
          onInterviewUpdated={updateInterview}
          onBeginInterview={() => setPracticeMode(true)}
        />
      ) : (
        <main className="canvas studio-dashboard" id="dashboard">
          <h1 className="sr-only">
            {user
              ? `Welcome back, ${user.display_name}`
              : "Your interview practice"}
          </h1>

          {error ? (
            <div className="error-state" role="alert">
              <div>
                <strong>{error.message}</strong>
                {error.errorId ? <p>Error ID: {error.errorId}</p> : null}
              </div>
              <button
                className="btn btn--sm"
                type="button"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          ) : null}

          <section className="studio-hero" aria-labelledby="hero-title">
            <div className="studio-hero__copy">
              <p className="studio-hero__eyebrow">
                {nextSession
                  ? `Next up · ${nextSession.title}`
                  : "Your private practice studio"}
              </p>
              <h2 id="hero-title">Practice the story, not the script.</h2>
              <p>
                {nextSession
                  ? "Pick up where you left off. We’ll focus on clear evidence, thoughtful trade-offs, and the moments that make your impact credible."
                  : "Build a source-backed profile, rehearse for a real role, and turn every answer into useful coaching feedback."}
              </p>
              <div className="studio-hero__actions">
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={creating || loading}
                  onClick={() =>
                    nextSession
                      ? openInterview(nextSession)
                      : void createSession()
                  }
                >
                  {nextSession ? null : <PlusIcon />}
                  {creating
                    ? "Creating…"
                    : nextSession
                      ? "Continue practice"
                      : "New practice session"}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
            <div className="studio-hero__art">
              <img
                src={onlineMeetingIllustration}
                alt="Two people preparing for an online interview"
              />
            </div>
          </section>

          <section id="progress-reports" className="studio-section-anchor">
            <div className="section-heading studio-section-heading">
              <div>
                <p className="section__eyebrow">Your momentum</p>
                <h2>Progress at a glance</h2>
              </div>
              <span className="section-heading__count">Your workspace</span>
            </div>
            <div className="stat-grid" aria-label="Workspace summary">
              <article className="card stat-card stat-card--practice">
                <div className="stat-card__copy">
                  <span className="stat-card__label">Practice rhythm</span>
                  <strong className="stat-card__value">
                    {loading ? "—" : interviews.length}
                  </strong>
                  <span className="stat-card__meta">
                    {interviews.length === 1
                      ? "session saved"
                      : "sessions saved"}
                  </span>
                </div>
                <div className="stat-card__visual" aria-hidden="true">
                  <img src={videoCallIllustration} alt="" />
                </div>
              </article>
              <article className="card stat-card stat-card--preparation">
                <div className="stat-card__copy">
                  <span className="stat-card__label">In preparation</span>
                  <strong className="stat-card__value">
                    {loading ? "—" : draftCount}
                  </strong>
                  <span className="stat-card__meta">
                    profiles and roles to finish
                  </span>
                </div>
                <div className="stat-card__visual" aria-hidden="true">
                  <img src={paperworkIllustration} alt="" />
                </div>
              </article>
              <article className="card stat-card stat-card--reports">
                <div className="stat-card__copy">
                  <span className="stat-card__label">Reports ready</span>
                  <strong className="stat-card__value">
                    {loading ? "—" : reportCount}
                  </strong>
                  <span className="stat-card__meta">
                    evidence-backed reviews
                  </span>
                </div>
                <div className="stat-card__visual" aria-hidden="true">
                  <img src={analyticsIllustration} alt="" />
                </div>
              </article>
            </div>
          </section>

          <section className="studio-lower-grid">
            <div
              className="card studio-sessions-panel"
              id="practice-sessions"
              aria-labelledby="sessions-title"
            >
              <div className="studio-panel-heading">
                <div>
                  <p className="section__eyebrow">Recent activity</p>
                  <h2 id="sessions-title">Practice sessions</h2>
                </div>
                <button
                  className="btn btn--primary btn--sm"
                  type="button"
                  disabled={creating || loading}
                  onClick={() => void createSession()}
                >
                  <PlusIcon size={16} />
                  {creating ? "Creating…" : "New session"}
                </button>
              </div>

              {loading ? (
                <div className="session-list" aria-label="Loading sessions">
                  <div className="session-card skeleton" />
                  <div className="session-card skeleton" />
                </div>
              ) : interviews.length === 0 ? (
                <div className="empty-state studio-empty-state">
                  <img
                    src={studyingIllustration}
                    alt="A person preparing notes for an interview"
                  />
                  <div>
                    <h3>No practice sessions yet</h3>
                    <p>
                      Start with a résumé and a role. Your setup, practice, and
                      feedback will stay together in one private workspace.
                    </p>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void createSession()}
                    >
                      <PlusIcon /> Create your first session
                    </button>
                  </div>
                </div>
              ) : (
                <div className="session-list">
                  {interviews.map((interview) => (
                    <article className="session-card" key={interview.id}>
                      <div className="session-card__icon">
                        <FileIcon />
                      </div>
                      <div className="session-card__content">
                        <div className="session-card__title-row">
                          <h3>{interview.title}</h3>
                          <span className={statusPillClass(interview.status)}>
                            {statusPill(interview.status).label}
                          </span>
                        </div>
                        <p className="session-card__meta">
                          <ClockIcon size={16} />
                          Created {formatDate(interview.created_at)}
                        </p>
                      </div>
                      <div className="session-card__actions">
                        <button
                          className="icon-btn session-card__delete"
                          type="button"
                          aria-label={`Delete ${interview.title}`}
                          title="Delete session"
                          onClick={() => setPendingDelete(interview)}
                        >
                          <TrashIcon />
                        </button>
                        <button
                          className="btn btn--sm"
                          type="button"
                          onClick={() => openInterview(interview)}
                        >
                          {sessionActionLabel(interview)}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <aside className="card studio-focus-card">
              <p className="section__eyebrow">Coach’s focus</p>
              <h2>
                {latestReport
                  ? "Turn feedback into one sharper story."
                  : "Build your evidence library."}
              </h2>
              <p>
                {latestReport
                  ? "Review your latest report, choose one gap, and rehearse the answer again while the context is fresh."
                  : "Your résumé and job description become the evidence map for every question, so coaching stays specific to you."}
              </p>
              <button
                className="btn btn--ghost studio-focus-card__action"
                type="button"
                onClick={() =>
                  latestReport ? void createSession() : openResumeAndRoles()
                }
              >
                {latestReport ? "Practice this focus" : "Prepare a role"}
                <span aria-hidden="true">→</span>
              </button>
            </aside>
          </section>

          <section
            className="card studio-settings-card"
            id="settings-privacy"
            aria-labelledby="privacy-title"
          >
            <div>
              <p className="section__eyebrow">Settings &amp; privacy</p>
              <h2 id="privacy-title">A calm space for private rehearsal.</h2>
              <p>
                Theme controls stay available in the sidebar. Camera and
                microphone permissions are requested only when a practice
                session needs them, and your session data remains inside your
                workspace.
              </p>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
              Use {theme === "light" ? "dark" : "light"} theme
            </button>
          </section>
        </main>
      )}

      {pendingDelete ? (
        <ConfirmationDialog
          title="Delete practice session?"
          body="This permanently removes its setup, transcript, report, and delivery metrics. This action cannot be undone."
          confirmLabel="Delete permanently"
          busy={deletingSession}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void deleteSession()}
        />
      ) : null}

      {showOnboarding && !loading && !error && !selectedInterview ? (
        <OnboardingTour onComplete={completeOnboarding} />
      ) : null}
    </div>
  );
}
