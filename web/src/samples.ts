/**
 * Ready-made resume and job description pairs.
 *
 * For visitors who want to try an interview without having a resume or a job
 * advert to hand. The resume is a real .docx fetched and submitted through the
 * ordinary upload endpoint, so a sample behaves exactly like a candidate's own
 * file rather than taking a shortcut that could drift from the real path.
 */

export interface SampleRole {
  id: string;
  label: string;
  /** Shown under the label, so the difference between samples is obvious. */
  summary: string;
  resumePath: string;
  resumeFileName: string;
  jobDescription: string;
}

const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const SAMPLE_ROLES: SampleRole[] = [
  {
    id: "video-editor",
    label: "Video editor",
    summary: "About 1 year of experience, short-form and YouTube",
    resumePath: "/assets/samples/sample-video-editor.docx",
    resumeFileName: "sample-video-editor.docx",
    jobDescription: `Video Editor (1+ year experience)
Kettle Studio — Bengaluru, hybrid

About the role
We produce short-form social video and long-form YouTube content for
direct-to-consumer brands. You will own edits end to end, from rushes through
to delivery, working to a weekly publishing calendar.

What you will do
- Cut 5 to 8 short-form videos each week for Reels, Shorts and TikTok, working
  from a written brief and a 48 hour turnaround.
- Edit one long-form YouTube episode every fortnight, including rough cut, fine
  cut, colour and mix.
- Grade footage for a consistent look across a brand's catalogue, and keep LUTs
  and project templates tidy for the rest of the team.
- Clean up dialogue audio, balance music beds and deliver to platform loudness
  targets.
- Take written client feedback, turn it into a clear change list, and turn
  around a recut the same day where possible.
- Keep media organised: proxies for 4K source, sensible bin structure, and
  archived projects that someone else can reopen.

What we are looking for
- Around a year of paid editing experience, in-house or freelance.
- Fluent in at least one of Premiere Pro, DaVinci Resolve or Final Cut Pro.
- Comfortable with basic motion graphics: lower-thirds, titles, simple 2D
  animation.
- An eye for pacing in short-form, and the patience for long-form structure.
- Able to explain an editing decision, not just make it.

Nice to have
- After Effects beyond templates.
- Experience with multicam or interview-style shoots.
- A portfolio showing both short and long-form work.`,
  },
  {
    id: "full-stack-engineer",
    label: "Full-stack engineer",
    summary: "About 2 years of experience, React and Python",
    resumePath: "/assets/samples/sample-full-stack-engineer.docx",
    resumeFileName: "sample-full-stack-engineer.docx",
    jobDescription: `Full Stack Engineer (2+ years experience)
Larkfield Technologies — Chennai, hybrid

About the role
You will work across a React and TypeScript front end and a Python API on a
subscription billing product used by several thousand customers. The team is
small, so you will be involved from design discussion through to production
support rather than being handed tickets.

What you will do
- Build customer-facing screens in React and TypeScript, with an eye to
  accessibility and to states beyond the happy path.
- Design and ship HTTP APIs in Python, including the boring parts: validation,
  pagination, idempotency and sensible error responses.
- Model data in PostgreSQL and write the migrations, rather than leaving schema
  changes to someone else.
- Find and fix performance problems with evidence: slow queries, N+1 access
  patterns, and endpoints that got quietly worse.
- Write tests you would trust on a Friday afternoon.
- Join the on-call rotation after onboarding, and write up what you learn when
  something breaks.
- Review pull requests and help newer engineers get their changes shipped.

What we are looking for
- Around two years building and running web applications in production.
- Solid TypeScript and React, including hooks and component composition.
- Comfortable in a Python web framework such as FastAPI, Django or Flask.
- Real SQL: joins, indexes, and an idea of why a query is slow.
- Able to talk through a trade-off you made and what it cost you.

Nice to have
- Docker and a CI pipeline you have configured yourself.
- Cloud experience on AWS or similar.
- Anything you have had to debug in production and then prevent.`,
  },
];

/**
 * Fetch a sample resume as a File, ready for the ordinary upload endpoint.
 *
 * Throws if the asset is missing, so the caller can say so rather than
 * presenting an empty upload field.
 */
export async function loadSampleResume(role: SampleRole): Promise<File> {
  const response = await fetch(role.resumePath);
  if (!response.ok) {
    throw new Error(
      `The ${role.label} sample resume could not be loaded (${response.status}).`,
    );
  }
  const blob = await response.blob();
  return new File([blob], role.resumeFileName, { type: DOCX_MEDIA_TYPE });
}
