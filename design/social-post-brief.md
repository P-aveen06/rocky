# Rocky · social post design handoff

Paste this whole file into Claude (or hand it to a designer) as the brief. It
carries everything needed to make the post without opening the codebase: the
one idea, the copy, the real brand tokens, the asset paths, and the claims that
are safe to make.

Repo root for every path below: the `rocky` repository.

---

## 1. The one idea

**Rocky gives you interview feedback it can prove.**

Everything else — the voice interview, the scorecard, the on-camera coaching —
is supporting evidence for that single sentence. If a layout or a line does not
serve it, cut it.

The product's own phrasing for this, already used on the landing page and worth
reusing verbatim:

> **Evidence, not vibes.**

That is the strongest three words we have. Treat it as the anchor.

---

## 2. What to make

**Primary — X / LinkedIn image card.**
- 1600 × 900 (16:9). Safe margin 80px on all sides.
- Must survive being seen at 400px wide in a timeline. Test it small before
  calling it done. If the headline is unreadable at 400px, the design failed.

**Secondary — 1080 × 1350 (4:5) portrait** for LinkedIn and Instagram feed,
which get more vertical space. Same idea, recomposed, not just letterboxed.

**Also supply:** the post copy itself (see §4), separately for X and LinkedIn.

---

## 3. Who is reading it

Students and freshers before campus placements. People moving to a new role or
switching careers. Trainers, mentors and placement teams who coach them.

They are not impressed by AI novelty. They have all been told "that was good!"
by a friend and learned nothing from it. Speak to that.

---

## 4. Copy

### Headline options, strongest first

1. **Evidence, not vibes.**
2. **Practice for the interview you actually want.** *(the product's own hero line)*
3. **"That was good!" is not feedback.**
4. **Your resume and the job ad. That's the whole setup.**

Pick one. Do not stack two headlines in one card.

### Supporting line (choose one, keep under 14 words)

- Rocky turns your resume and a real job ad into a live interview.
- Every score points at the sentence in your transcript that earned it.
- A live voice interview, then feedback tied to what you actually said.

### X post copy (280 chars, no hashtag soup)

> Most interview prep is guesswork. You rehearse at a mirror, a friend says
> "that was good!", and you learn nothing.
>
> Rocky runs a live voice interview from your resume + the job ad, then scores
> you against a scorecard — every point tied to a quote from your transcript.
>
> Built in 20 hours.

Then the demo link as a reply or the second line. One link per post.

### LinkedIn copy (longer, keep the first two lines strong — the rest is behind
"see more")

> "That was good!" is the most useless sentence in interview prep.
>
> So I built Rocky. You give it your resume and the job ad you're actually
> applying to. It reads your resume into source-linked evidence, turns the job
> ad into a weighted scorecard, then runs a live voice interview that follows up
> when your answer is vague.
>
> The report at the end scores each competency and shows the exact sentence from
> your transcript that earned the score. If a competency never came up, it says
> "not assessed" instead of guessing.
>
> No resume stored. No audio or video recorded. On-camera framing feedback runs
> entirely in your browser.
>
> Built in a 20-hour hackathon. Free to try, no signup.

### CTA

`Try it — no signup` · link. One CTA, not three.

---

## 5. Visual direction

The brand is **warm, calm, slightly hand-made** — a rehearsal studio, not a
dashboard. Space-program mission patch as the mark. Nothing clinical, nothing
neon, nothing that looks like a generic SaaS template.

### Palette (verified from source, use these exact values)

**Brand / patch — the warm set, use this for the post:**

| Token | Hex | Use |
|---|---|---|
| Coral | `#C1502E` | Accent, arrows, the one thing you want looked at |
| Ink | `#1C1B19` | Headline type |
| Cream | `#F5EFE3` | Card fills, warm background |
| Warm dark | `#2A2723` | Dark-mode background |
| Cream ink | `#EFE7DA` | Type on dark |
| Light coral | `#E58150` | Accent on dark |

**Product UI — only if you show real app chrome** (`web/src/studio.css`):
canvas `#FBFAF8`, surface `#FFFFFF`, border `#EDEBE7`, text `#18181B`, muted
text `#52525B`, indigo accent `#3B5BDB`, success `#237A57`.

Note the tension: the patch is coral, the app UI accent is indigo. **Let coral
lead in the post** and let the indigo appear only inside genuine screenshots.
Do not introduce a third accent.

### Type

Inter (already the product typeface, `@fontsource/inter`). JetBrains Mono for
anything that should read as data or a transcript line.

Headline: Inter, tight tracking, heavy weight, ragged right, two or three lines
max. The landing page sets headlines large and tight — match that energy.

### Motifs available

- **The mission patch** — shield, dark field, coral border, cream banner reading
  ROCKY, a gray rock-alien coiled around a gold starburst. Distinctive. Use it
  whole; never crop it into a corner sliver, never recolor it.
- **Hand-drawn diagram language** — the README diagrams are Excalidraw: cream
  boxes, ink outlines, coral arrows, sketchy edges. This is a great device for
  showing the flow in a post. Reuse the aesthetic, not necessarily the file.
- **Blush illustrations** (Susana Salas, `design/assets/blush/`) — used
  throughout the product. Check licensing before putting one in a public post.

---

## 6. Three concepts

**A. The receipt** *(recommended)*
A tight crop of the real report card: a competency, its score, and directly
beneath it the transcript quote that earned it. A hand-drawn coral arrow links
quote to score. Headline top-left: "Evidence, not vibes." This is the product's
whole argument in one image, and it uses real output rather than a promise.

**B. Mission control**
Patch centered on cream, generous space, headline beneath in tight Inter. Small
coral caption: "Live interview practice. Built in 20 hours." Confident and
quiet. Best if the goal is brand recall rather than explanation.

**C. The split**
Left: a flat grey speech bubble, "that was good!" — deliberately lifeless.
Right: a real scorecard row in full colour with its quote. One coral divider
down the middle. Argumentative and very legible at small sizes.

A is the strongest for a launch post. B works as a follow-up. C works if the
audience needs convincing that this differs from a generic AI mock interview.

---

## 7. Assets in the repo

| What | Path |
|---|---|
| Mission patch, 1254px, transparent | `design/assets/brand/rocky-mission-patch.png` |
| Patch, small | `docs/screenshots/rocky-patch.png` |
| Full report screenshot | `docs/screenshots/report.png` |
| Live interview room | `docs/screenshots/interview.png` |
| Generated scorecard | `docs/screenshots/scorecard.png` |
| Resume evidence review | `docs/screenshots/resume-evidence.png` |
| Dashboard, light and dark | `docs/screenshots/dashboard.png`, `dashboard-dark.png` |
| Mobile | `docs/screenshots/dashboard-mobile.png` |
| Flow diagram, editable | `docs/diagrams/product-flow.excalidraw` |
| Flow diagram, rendered | `docs/diagrams/product-flow-light.svg` |
| Illustrations | `design/assets/blush/` |

All screenshots are real captures of the live app, already framed with a 1px
warm border. If you crop one, keep the border or re-add it.

---

## 8. Do / don't

**Do**
- Let one element dominate. A social card has room for exactly one focal point.
- Use real product output. The report is more persuasive than any illustration.
- Keep the coral for the single thing you want looked at.
- Leave real whitespace. The brand is calm.

**Don't**
- Purple or blue-to-purple gradients.
- The three-column feature grid with icons in coloured circles.
- Emoji as design elements. Rockets especially.
- Decorative blobs, floating circles, wavy dividers.
- Centre-aligning every line.
- Drop shadows on everything. If the design collapses without them, it was
  never working.
- Stock photos of people shaking hands.

---

## 9. Claims

**Safe to state** (all verified in the product):
- Turns a resume and a job description into a live voice interview.
- Sessions from 2 to 60 minutes.
- Every score is tied to a quote from your own transcript.
- Says "not assessed" when a competency never came up.
- Report downloads as a single self-contained HTML file.
- Guest access, no signup.
- The resume file is discarded right after text extraction.
- Answer audio is never written to disk; no video is uploaded or stored.
- On-camera framing feedback runs entirely in the browser.
- Built in a 20-hour hackathon.
- Named after the alien engineer in *Project Hail Mary*.

**Do not claim**
- Any user count, download count, or growth number. There are none yet.
- Any accuracy percentage or benchmark score. None has been measured.
- That it predicts, improves, or influences hiring outcomes. It is a coaching
  tool and says so.
- That it detects confidence, emotion, stress, or honesty. It explicitly does
  not, and saying otherwise breaks the product's core promise.
- Testimonials or quotes from users. None exist.
- Comparisons to named competitors.

---

## 10. Links

- Live demo — https://app-2c7f-8000.prg1.zerops.app
- Video walkthrough — https://youtu.be/3f3UjxkfLP0
- Write-up — https://medium.com/@paveenkumar.dev/rocky-3717406e2db2
- Existing X post — https://x.com/paveen_kumar06/status/2086513152213266615

One link per post. Put it in the post body on LinkedIn, and in the first reply
on X if reach matters more than convenience.
