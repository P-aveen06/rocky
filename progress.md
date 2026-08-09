# Rocky project handoff

Last updated: 2026-08-09 (Asia/Kolkata)  
Repository: `rocky`  
Branch: `main`  
Current HEAD: `592659c1c289d50278285de896974bbac52c804c`

## Read this first

This repository has a deliberately dirty worktree containing the latest UI and
interview-duration work. Do not reset, checkout, clean, or overwrite it. Review
and continue from the current files.

The latest verification is green:

- Frontend build and ESLint passed.
- Frontend Vitest suite: **97 passed** across 11 test files.
- Backend Pytest suite: **117 passed** with one existing Starlette/httpx
  deprecation warning.
- `git diff --check` passed.

## Product summary

Rocky is a browser-based live interview-preparation product named after the
character from _Project Hail Mary_. It is designed for a wide audience:
students, working professionals, career switchers, freshers, trainers,
placement teams, bootcamps, colleges, mentors, and learning-and-development
teams.

The complete user journey is:

1. Land on a public product page and understand what Rocky does.
2. Enter through guest access or managed sign-in.
3. Follow a first-use walkthrough.
4. Upload a résumé and review source-backed evidence.
5. Add a target role and job description.
6. Generate and edit a role-specific scorecard.
7. Complete interview preflight and choose the session format.
8. Run a voice or developer-text interview.
9. Receive an evidence-backed report with optional delivery coaching.
10. Download the report as a standalone `.html` file.

## Approved product and design decisions

- Product name is **Rocky**.
- The approved visual direction is Option A: a compact, warm, Notion-inspired
  “rehearsal studio,” with subtle gradients, borders, restrained shadows, and
  meaningful hover effects.
- Use the **The Little Things** Blush collection by Susana Salas as the primary
  in-product illustration family. Avoid mixing illustration styles in the core
  app.
- Illustrations should support meaningful moments such as landing, onboarding,
  setup, preflight, processing, report, empty, privacy, and success states. Do
  not add decorative art beside every small element.
- The application shell uses only the left sidebar. The duplicate top bar was
  removed.
- The sidebar is collapsible and stores its state in local storage under
  `rocky-sidebar-collapsed`.
- Sidebar navigation contains Dashboard, Practice sessions, Progress & reports,
  and Résumé & roles. Settings and Privacy are not sidebar destinations.
- The dashboard may still contain the informational Settings & privacy card;
  the user specifically requested removing those entries from the sidebar.
- The first-use walkthrough stores completion under
  `rocky-onboarding-complete`.
- The dashboard should not duplicate multiple report-navigation buttons.
- The report must remain compact, evidence-focused, and downloadable as HTML.
- Interview duration choices are now **2, 5, 15, 30, 45, and 60 minutes**.
  Fifteen minutes remains the default.
- Two- and five-minute interviews are quick-practice formats with focused
  evidence probes, not compressed versions of every section in a long
  interview.

## Implemented and committed before this handoff

### Landing and entry flow

- Rocky is the primary public entry point through `web/src/RockyRoot.tsx`.
- `web/src/LandingPage.tsx` explains the product, broad audience, workflow,
  privacy, and value proposition.
- The landing page includes **The Journey of Rocky**, describing the first 20
  hackathon hours.
- A demo-video section and visual placeholder exist. The real demo video still
  needs to be supplied and wired in.
- The landing page and application use optimized local Blush PNG assets from
  `web/src/assets/blush/`.
- Asset sources and license notes are recorded in
  `design/assets/blush/SOURCES.md`.

### Reimagined application UI

- Compact sidebar-only workspace shell with persistent collapse behavior.
- Warm paper-like canvas, ink typography, coral/blue/mint/butter accents, dark
  mode, responsive layouts, and reduced-motion support.
- Illustrated dashboard hero, gradient momentum cards, hover effects, recent
  session list, and coach-focus card.
- First-time onboarding walkthrough using `web/src/OnboardingTour.tsx`.
- Illustrated setup, preflight, report-processing, report, and empty states.
- Compact report layout with evidence score, coverage, competency feedback,
  transcript evidence, delivery coaching, and standalone HTML export.
- Report export implementation lives in `web/src/reportExport.ts`.

### Existing product foundation

- React + TypeScript + Vite frontend.
- FastAPI + SQLAlchemy backend with SQLite locally and PostgreSQL support.
- Local, Clerk, and guest authentication flows.
- PDF/DOCX résumé ingestion with source-backed profile claims.
- Target-role and editable scorecard workflow.
- Azure OpenAI Realtime voice interviews plus developer-text mode.
- Dual voice transcription and evidence-backed evaluation/report generation.
- Optional speaking and on-camera delivery coaching.
- Session deletion, privacy, quota, retention, and usage controls.
- Zerops deployment definitions and GitHub Actions deployment workflow.

## Current uncommitted implementation

These changes are present in the working tree and have passed the test suites.

### Editable practice-session name

- Added `PATCH /api/interviews/{interview_id}`.
- Added `UpdateInterviewRequest` with trimming and visible-character
  validation.
- Added `api.updateInterviewTitle()`.
- The setup-page heading now has an accessible inline editor with Save, Cancel,
  Escape, blur-save, loading, success, and error behavior.
- Tests cover API persistence and the frontend request.

Relevant files:

- `server/api/routes/interviews.py`
- `server/api/schemas.py`
- `server/tests/test_api.py`
- `web/src/SetupPage.tsx`
- `web/src/api.ts`
- `web/src/icons.tsx`
- `web/src/App.test.tsx`
- `web/src/studio.css`

### Guest-access redesign

- Replaced the plain centered form with a responsive two-panel guest-entry
  experience.
- Added Rocky branding, interview-preparation copy, privacy/trust points,
  studying illustration, subtle gradients, dotted background, and button hover
  motion.
- Mobile layouts hide the large illustration and reduce density.
- Added a guest sign-in component test.

Relevant files:

- `web/src/GuestSignIn.tsx`
- `web/src/GuestSignIn.test.tsx`
- `web/src/auth.tsx`
- `web/src/styles.css`

### Layout refinements

- Preflight now uses the full available canvas instead of leaving a large blank
  column on the right.
- The report-processing/evaluation card is centered in the available content
  area.
- The report page uses a processing-specific canvas class for both normal and
  recoverable processing states.

Relevant files:

- `web/src/styles.css`
- `web/src/studio.css`
- `web/src/ReportPage.tsx`

### Two- and five-minute interviews

- Backend capability list and validation now allow 2 and 5 minutes alongside
  15, 30, 45, and 60.
- Validation copy is generated from the canonical duration tuple.
- The frontend fallback duration list includes all six options.
- Prompt section plans exist for both quick formats and sum to the selected
  duration.
- Quick-format prompt policy asks one focused evidence question with a concise
  follow-up.
- Added UI and backend prompt-plan tests.

Relevant files:

- `server/domain/interview.py`
- `server/api/routes/realtime.py`
- `server/prompts/interview_v1.py`
- `server/tests/test_interview_prompt.py`
- `server/tests/test_api.py`
- `web/src/PracticePage.tsx`
- `web/src/PracticePage.test.tsx`

## Current working-tree inventory

Modified:

- `server/api/routes/interviews.py`
- `server/api/routes/realtime.py`
- `server/api/schemas.py`
- `server/domain/interview.py`
- `server/prompts/interview_v1.py`
- `server/tests/test_api.py`
- `web/src/App.test.tsx`
- `web/src/GuestSignIn.tsx`
- `web/src/PracticePage.test.tsx`
- `web/src/PracticePage.tsx`
- `web/src/ReportPage.tsx`
- `web/src/SetupPage.tsx`
- `web/src/api.ts`
- `web/src/auth.tsx`
- `web/src/icons.tsx`
- `web/src/studio.css`
- `web/src/styles.css`

Untracked:

- `server/tests/test_interview_prompt.py`
- `web/src/GuestSignIn.test.tsx`
- `progress.md` after this handoff is created

No files are staged and no commit has been created for this working-tree batch.

## Recommended next steps for Claude

1. Read this file, then inspect `git status` and `git diff`. Preserve all current
   edits.
2. Run the app and visually review the guest screen, editable setup title,
   preflight width, processing-card centering, and 2/5-minute selector at wide
   and mobile widths.
3. Confirm a 2-minute and a 5-minute session through the live API when Azure
   Realtime credentials are available. Automated coverage passes, but the real
   provider timing should still be manually observed.
4. Wire the actual demo video into the landing page when the user supplies it.
   Keep a poster/fallback and accessible controls.
5. Decide with the user whether the informational Settings & privacy dashboard
   card should remain. Its sidebar entries are already removed as requested.
6. Consider updating README wording from “AI Interview Coach” to “Rocky” and
   expand the M3 manual acceptance section to mention 2- and 5-minute quick
   sessions.
7. Re-check responsive visual quality at 360, 768, 1024, and 1440 pixels,
   keyboard navigation, focus visibility, reduced motion, and 200% zoom.
8. Re-check the active Blush plan/license before production release. PNG source
   notes exist, but production rights should be confirmed.
9. When satisfied, split or commit the current batch intentionally. Do not use
   `git add -A` without reviewing unrelated files.

## Local development commands

The Vite proxy currently targets API port **8000**.

Backend:

```bash
cd server
./.venv/bin/uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend, in a second terminal:

```bash
cd web
npm run dev
```

Open `http://127.0.0.1:5173/`. Do not open `web/index.html` using `file://`;
browser security blocks Vite’s TypeScript module loading in that mode.

The existing `.claude/launch.json` points to
`../Live-Interview-Prep/venv/bin/python` and starts port 8002. That path appears
to be from the earlier project location and does not match the current Vite
proxy. Update the launch configuration before relying on it, or use the commands
above. The repository-local Python environment is `server/.venv`.

## Verification commands

Frontend:

```bash
cd web
npm run build
npm run lint
npm test -- --run
```

Backend:

```bash
cd server
./.venv/bin/python -m pytest tests -q
```

Optional full formatting checks from the repository root:

```bash
cd server
./.venv/bin/python -m ruff format --check api domain evals migrations prompts scripts tests
./.venv/bin/python -m ruff check api domain evals migrations prompts scripts tests

cd ../web
npm run format:check
```

## Key files to orient quickly

- `web/src/RockyRoot.tsx`: landing-to-application entry decision.
- `web/src/LandingPage.tsx`: public landing page and Journey of Rocky.
- `web/src/App.tsx`: workspace shell, sidebar, dashboard, routing state, and
  onboarding trigger.
- `web/src/OnboardingTour.tsx`: first-use walkthrough.
- `web/src/SetupPage.tsx`: résumé, target role, scorecard, and title editor.
- `web/src/PracticePage.tsx`: preflight and live interview runtime.
- `web/src/ReportPage.tsx`: processing and evidence-report states.
- `web/src/reportExport.ts`: standalone HTML report generation.
- `web/src/studio.css`: main rehearsal-studio component styles.
- `web/src/landing.css`: landing-page styles.
- `web/src/styles.css`: legacy/shared styles and latest guest/preflight changes.
- `server/api/routes/interviews.py`: session CRUD and rename endpoint.
- `server/api/routes/realtime.py`: start validation and Realtime lifecycle.
- `server/domain/interview.py`: interview constants and allowed durations.
- `server/prompts/interview_v1.py`: duration plans and interviewer policy.
- `design/REDESIGN_PLAN.md`: original design rationale and phased plan.
- `design/assets/blush/SOURCES.md`: downloaded illustration source manifest.

## Known follow-up notes

- `README.md` still begins with “AI Interview Coach,” although the UI and page
  title are Rocky.
- The landing-page demo is intentionally a placeholder.
- Blush PNGs are comparatively large. Production performance may benefit from
  WebP/AVIF variants and responsive image loading after visual sign-off.
- The report HTML export is already implemented and tested; do not replace it
  with PDF unless the user changes the requirement.
- Keep evidence scoring separate from optional speaking/on-camera coaching.
  Delivery observations must never alter the role-fit evidence score.
- Voice and camera permission remain explicit opt-ins during preflight.
