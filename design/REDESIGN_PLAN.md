# Interview Coach redesign plan

Status: concept for alignment; no production UI has been replaced yet.

## Product idea

Reimagine the app as a calm rehearsal studio rather than a generic analytics dashboard. The experience should move candidates through one emotional arc:

1. **Orient** — show the next useful action, not a wall of metrics.
2. **Prepare** — make resume, role, and scorecard setup feel finite and safe.
3. **Rehearse** — reduce technical anxiety before the camera turns on.
4. **Reflect** — turn the report into evidence and one clear next practice target.
5. **Progress** — make improvement visible across sessions.

The dashboard concept uses a warm paper canvas, ink-like typography, compact navigation, and the coral/blue/mint/yellow palette taken from Susana Salas’s **The Little Things** illustrations.

## Blush collection audit

The full Blush collection catalog was scanned and interview, practice, learning, report, video-call, work, and analytics contexts were checked. These were the relevant families:

| Collection | Useful contexts | Decision |
| --- | --- | --- |
| **The Little Things — Susana Salas** | Business planning, process, working, studying, online meeting, video call, paperwork, privacy, analytics, check/success | **Primary family.** Broadest coverage and the best balance of professional, human, and optimistic. |
| Tech Life — Karthik Srinivas | Remote work, communication, email, schedule, user | Reserve only. Elegant but monochrome and too sparse for the entire emotional arc. |
| Dayflow | Work from home, study, chat, review, success notification | Reserve only. Friendly and flexible, but less interview-specific. |
| Shiny Happy — Brandon Mendoza | One-to-one, briefing, checklist, graphs, video, office | Good marketing/onboarding alternative; too visually loud for dense coaching screens. |
| Palz | Video-call moments and character-led scenes | Not selected; style would introduce a second character language without adding needed coverage. |
| Stuck at Home | Meet-online and home-working scenes | Not selected; the lockdown/home-bound framing is dated for a 2026 professional product. |
| Wonder Learners | Online class, student focus, stats, computer, clock | Not selected; reads as school/child learning rather than career coaching. |
| Lifesavers | Consulting, one-to-one, video call, online study, stats | Not selected; medical associations conflict with interview coaching. |

### Direction

Use one illustration family throughout the core product. Mixing collections should be an exception for marketing pages only. In-product illustrations appear at meaningful moments—hero, empty, preflight, processing, privacy, success—not beside every metric.

## Downloaded asset set

All files are large transparent PNG exports from **The Little Things** and live in `design/assets/blush/`.

| File | Intended use |
| --- | --- |
| `online-meeting.png` | Dashboard hero and live-practice entry |
| `business-planning.png` | Role definition and scorecard setup |
| `paperwork.png` | Resume/profile setup |
| `video-call.png` | Camera and microphone preflight |
| `process.png` | Report processing/loading |
| `analytics.png` | Report overview and progress empty state |
| `check.png` | Successful setup/report completion |
| `lock-docs.png` | Recording/privacy explanation |
| `studying.png` | First-session empty state and practice guidance |
| `work-window.png` | Draft/session recovery state |
| `home-office.png` | Environmental setup and coaching tips |

Before production launch, confirm the final export rights and attribution requirements against the active Blush account/plan. Keep the original filenames and a source manifest in the repository.

## Information architecture

### Global shell

- **Home** — next practice, momentum, recent sessions, coach’s focus.
- **Practice** — drafts, completed sessions, new-practice entry.
- **Progress** — score trends, competency coverage, recurring coaching signals.
- **Profile** — resume profile, target roles, preferences, data controls.
- Privacy and settings remain visible but visually secondary.

On mobile, the sidebar collapses to a four-item bottom navigation. During an interview, the global shell disappears so the user has a focused room.

### Dashboard

- Lead with the next action and target role.
- Show only three longitudinal signals: practice rhythm, evidence score, delivery pace.
- Keep recent sessions scannable with explicit states: Draft, Processing, Report ready.
- Surface one coach-selected improvement target with a five-minute drill.
- Use the Blush hero as a single emotional anchor; avoid illustrations inside data cards.

### Practice setup

Turn the current setup page into a three-step guided workspace:

1. **Your experience** — parsed resume, editable evidence cards, privacy reassurance.
2. **The role** — target role/company, interview type, seniority, job description.
3. **Your scorecard** — prioritized competencies, suggested signals, coverage check.

The user can save and resume. Each step has a plain-language completion state and a single primary action.

### Preflight and interview room

- Combine device checks into one calm preflight panel with live camera preview.
- Explain recording and AI processing beside `lock-docs.png` before permissions are requested.
- In the room, keep the question, timer, and end controls primary; transcript and coaching signals stay collapsible.
- Use a low-stimulation visual treatment and no decorative illustration during an active answer.
- Add explicit states for permission denied, device lost, connection degraded, answer retry, and session recovery.

### Report and progress

- Open with a one-paragraph coach summary and one recommended next drill.
- Group feedback into **Evidence**, **Structure**, and **Delivery**.
- Show claims next to transcript evidence; distinguish observed evidence from AI inference.
- Make strengths and growth areas actionable with replayable moments and example rewrites.
- Move the full transcript behind a secondary tab/drawer.
- Link the report to longitudinal progress rather than treating it as a one-off document.

## Visual system

### Color tokens

| Token | Value | Purpose |
| --- | --- | --- |
| Canvas | `#F5F1E9` | Warm, low-glare application background |
| Surface | `#FFFDF9` | Cards and panels |
| Ink | `#211F1C` | Primary text and strong controls |
| Muted | `#706B63` | Supporting text |
| Coral | `#ED6D63` | Human accent and selected/high-energy moments |
| Sky | `#90ABE2` | Informational and coaching surfaces |
| Mint | `#88BDA8` | Progress and positive signals |
| Butter | `#F5DF72` | Focus and prompts |

Semantic success, warning, and error colors remain independent from illustration accents. All foreground/background pairs must pass WCAG AA.

### Type, shape, and motion

- Use **Avenir Next** or a licensed humanist sans for the product UI; use a restrained mono face for scores and timestamps.
- 4px spacing system; 44px minimum hit targets.
- 10–12px control radius, 15–22px panel radius. Avoid making every element pill-shaped.
- One soft shadow level plus borders for hierarchy.
- 160–220ms motion for navigation and state changes; respect reduced-motion preferences.
- Illustrations never communicate status without accompanying text.

## Delivery phases

### Phase 0 — Baseline and content model

- Capture every current route/state and analytics event.
- Freeze the revised navigation, session states, report taxonomy, and core copy.
- Add an illustration source/license manifest.

### Phase 1 — Foundations

- Introduce CSS design tokens and shared primitives: Button, IconButton, Card, Badge, Stepper, EmptyState, Skeleton, Dialog, Toast.
- Build the responsive application shell and keyboard/focus behavior.
- Add optimized responsive image outputs while retaining the original PNGs.

### Phase 2 — Dashboard and session library

- Implement the approved dashboard concept.
- Add filters/search, draft recovery, processing states, and first-use empty state.
- Instrument continue-practice, start-practice, and report-open events.

### Phase 3 — Guided setup

- Redesign resume, role, and scorecard into the three-step flow.
- Preserve edits across refresh and surface parse/validation errors inline.
- Add privacy copy before document processing.

### Phase 4 — Preflight and interview room

- Build device permission, live preview, connection, and recovery states.
- Simplify the room around the active question and answer.
- Test camera-off, audio-only, keyboard-only, and screen-reader paths.

### Phase 5 — Report and progress

- Recompose the report around coach summary, evidence, structure, delivery, and next drill.
- Add longitudinal competency and delivery trends.
- Keep transcript evidence traceable and AI inference visibly labeled.

### Phase 6 — Quality and rollout

- Responsive QA at 360, 768, 1024, and 1440px.
- WCAG AA contrast, keyboard, screen reader, reduced motion, and 200% zoom checks.
- Optimize LCP/illustration payloads; lazy-load below-the-fold assets.
- Release behind a feature flag, compare completion and report-open rates, then remove the old UI.

## Acceptance signals

- A returning user can resume the right practice in one click.
- A new user understands the setup sequence without external explanation.
- Device permissions are requested only after the user understands why.
- Every coaching claim can point to observable evidence or is explicitly labeled as inference.
- The dashboard remains useful with zero, one, or many sessions.
- No page uses more than one large illustration.

## Alignment decisions needed before implementation

1. Approve **The Little Things** as the single in-product illustration family.
2. Approve the compact left navigation and warm “rehearsal studio” direction.
3. Confirm whether “Interview Coach” is the final product name or a placeholder.
4. Confirm whether the visual refresh may also change navigation/content structure, or must preserve the current route model exactly.
