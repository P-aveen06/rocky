import type { InterviewReport, InterviewSession } from "./types";

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function scoreLabel(score: number | null): string {
  return score === null ? "Not assessed" : `${score.toFixed(1)} / 5`;
}

function renderList(items: string[], emptyCopy: string): string {
  if (items.length === 0)
    return `<p class="muted">${escapeHtml(emptyCopy)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return slug || "interview-report";
}

export function reportFileName(interview: InterviewSession): string {
  return `rocky-${slugify(interview.title)}.html`;
}

export function reportToHtml(
  interview: InterviewSession,
  report: InterviewReport,
): string {
  const completedAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(report.completed_at));
  const assessedCount = report.competency_results.filter(
    (result) => result.score !== null,
  ).length;

  const competencies = report.competency_results
    .map((result) => {
      const evidence = result.evidence.length
        ? `<div class="evidence"><h3>Transcript evidence</h3>${result.evidence
            .map(
              (item) =>
                `<blockquote><p>“${escapeHtml(item.quote)}”</p><cite>Candidate answer · Turn ${escapeHtml(item.sequence)}</cite></blockquote>`,
            )
            .join("")}</div>`
        : "";
      const meta =
        result.score === null
          ? (result.not_assessed_reason ??
            "The interview did not collect enough evidence.")
          : `${result.weight}% weight · ${result.rating_confidence ?? "unknown"} confidence`;

      return `<article class="competency">
        <header>
          <div>
            <span class="tag">${escapeHtml(result.classification)}</span>
            <h2>${escapeHtml(result.name)}</h2>
            <p class="muted">${escapeHtml(meta)}</p>
          </div>
          <strong>${escapeHtml(scoreLabel(result.score))}</strong>
        </header>
        ${result.evidence_summary ? `<p>${escapeHtml(result.evidence_summary)}</p>` : ""}
        ${evidence}
        <div class="two-column">
          <section><h3>Evidence gaps</h3>${renderList(result.gaps, "No competency-specific gaps were identified.")}</section>
          <section><h3>Next practice</h3>${renderList(result.recommendations, "No additional practice recommendation was generated.")}</section>
        </div>
      </article>`;
    })
    .join("");

  const exercises = report.practice_exercises.length
    ? report.practice_exercises
        .map(
          (exercise, index) => `<article class="exercise">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>${escapeHtml(exercise.title)}</h3>
              <p>${escapeHtml(exercise.instruction)}</p>
              <strong>Success criteria</strong>
              ${renderList(exercise.success_criteria, "No success criteria supplied.")}
            </div>
          </article>`,
        )
        .join("")
    : '<p class="muted">Exercises require at least one assessed competency.</p>';

  const transcript = report.transcript.length
    ? `<ol class="transcript">${report.transcript
        .map(
          (
            turn,
          ) => `<li class="${turn.speaker === "user" ? "candidate" : "interviewer"}">
            <span>${turn.speaker === "user" ? "Candidate" : "Interviewer"} · Turn ${escapeHtml(turn.sequence)}</span>
            <p>${escapeHtml(turn.transcript)}</p>
          </li>`,
        )
        .join("")}</ol>`
    : '<p class="muted">No transcript turns were available.</p>';

  const delivery = report.delivery_coaching
    ? `<section class="section page-break">
        <p class="eyebrow">Separate coaching dimension</p>
        <h2>Speaking delivery</h2>
        <p class="muted">Observable speaking patterns only. They never change the evidence score.</p>
        ${
          report.delivery_coaching.status === "available"
            ? `${
                report.delivery_coaching.baseline
                  ? `<div class="metrics">
                      <div><span>Baseline pace</span><strong>${escapeHtml(report.delivery_coaching.baseline.words_per_minute)} wpm</strong></div>
                      <div><span>Filler phrases</span><strong>${escapeHtml(report.delivery_coaching.baseline.filler_words_per_100_words)} / 100 words</strong></div>
                      <div><span>Baseline answers</span><strong>${escapeHtml(report.delivery_coaching.baseline.turn_count)}</strong></div>
                    </div>`
                  : '<p class="muted">A speaking baseline was not available.</p>'
              }
              <div class="two-column">
                <section><h3>Observations</h3>${renderList(
                  report.delivery_coaching.observations.map(
                    (observation) => observation.text,
                  ),
                  "No delivery observations were generated.",
                )}</section>
                <section><h3>Practice suggestions</h3>${renderList(
                  report.delivery_coaching.suggestions,
                  "No delivery suggestions were generated.",
                )}</section>
              </div>`
            : `<p class="muted">Delivery coaching status: ${escapeHtml(report.delivery_coaching.status)}.</p>`
        }
      </section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(interview.title)} · Rocky report</title>
  <style>
    :root { --bg:#fbfaf8; --surface:#fff; --sunken:#f5f4f1; --line:#edebe7; --text:#18181b; --muted:#52525b; --accent:#3b5bdb; --soft:#eef2ff; --success:#167447; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--text); background:var(--bg); font:14px/1.5 Inter, ui-sans-serif, system-ui, sans-serif; }
    main { width:min(1080px, calc(100% - 32px)); margin:0 auto; padding:32px 0 64px; }
    h1,h2,h3,p { margin:0; } h1,h2,h3 { line-height:1.2; letter-spacing:-.02em; } h1 { font-size:28px; }
    .brand { display:flex; align-items:center; gap:10px; margin-bottom:24px; font-weight:700; }
    .brand-mark { display:grid; width:28px; height:28px; place-items:center; border:1px solid var(--text); border-radius:8px; background:#fff4cc; }
    .header { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; padding-bottom:20px; border-bottom:1px solid var(--line); }
    .eyebrow { margin-bottom:6px; color:var(--muted); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    .header .muted { margin-top:8px; } .muted { color:var(--muted); }
    .ready { color:var(--success); font-weight:700; white-space:nowrap; }
    .metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:16px 0; }
    .metrics > div, .card, .competency, .section { padding:16px; border:1px solid var(--line); border-radius:12px; background:var(--surface); }
    .metrics span, .metrics strong { display:block; } .metrics span { color:var(--muted); font-size:12px; } .metrics strong { margin-top:4px; font-size:22px; }
    .context { display:flex; justify-content:space-between; gap:24px; margin-bottom:16px; padding:12px 16px; border-radius:8px; background:var(--soft); }
    .layout { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(260px,.75fr); gap:16px; align-items:start; }
    .stack { display:grid; gap:12px; } .section-title { margin-bottom:10px; }
    .competency { display:grid; gap:12px; }
    .competency header { display:flex; justify-content:space-between; gap:16px; }
    .competency header > strong { color:var(--accent); font-size:18px; white-space:nowrap; }
    .competency h2 { margin-top:6px; font-size:18px; }
    .tag { display:inline-flex; padding:2px 7px; border-radius:999px; color:var(--muted); background:var(--sunken); font-size:11px; font-weight:700; }
    ul { margin:8px 0 0; padding-left:18px; } li + li { margin-top:4px; }
    blockquote { margin:8px 0 0; padding:10px 12px; border-left:2px solid var(--accent); background:var(--sunken); }
    blockquote cite { display:block; margin-top:5px; color:var(--muted); font-size:11px; font-style:normal; }
    .two-column { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; padding-top:12px; border-top:1px solid var(--line); }
    .two-column h3, .card h3 { font-size:13px; }
    .exercise { display:grid; grid-template-columns:auto 1fr; gap:10px; padding-top:12px; }
    .exercise > span { color:var(--accent); font-family:monospace; font-size:11px; }
    .exercise p { margin:4px 0 8px; color:var(--muted); }
    .transcript { display:grid; gap:8px; padding:0; list-style:none; }
    .transcript li { padding:10px 12px; border-radius:8px; background:var(--sunken); }
    .transcript li.candidate { border-left:2px solid var(--accent); }
    .transcript span { color:var(--muted); font-size:11px; } .transcript p { margin-top:3px; }
    .section { margin-top:16px; } footer { margin-top:20px; color:var(--muted); font-size:11px; }
    @media (max-width:760px) { .layout,.metrics,.two-column { grid-template-columns:1fr; } .header,.context { align-items:flex-start; flex-direction:column; } }
    @media print { body { background:#fff; } main { width:100%; padding:0; } .page-break { break-before:page; } .competency,.card,.section { break-inside:avoid; } }
  </style>
</head>
<body>
  <main>
    <div class="brand"><span class="brand-mark">R</span> Rocky</div>
    <header class="header">
      <div><p class="eyebrow">Evidence report</p><h1>${escapeHtml(interview.title)}</h1><p class="muted">${escapeHtml(report.target_role.seniority)} ${escapeHtml(report.target_role.title)} · ${escapeHtml(report.candidate_profile.headline)}</p></div>
      <span class="ready">Report ready</span>
    </header>
    <section class="metrics" aria-label="Evaluation summary">
      <div><span>Weighted evidence score</span><strong>${escapeHtml(scoreLabel(report.overall_score))}</strong></div>
      <div><span>Evidence coverage</span><strong>${escapeHtml(report.coverage_percentage)}%</strong></div>
      <div><span>Competencies assessed</span><strong>${assessedCount} / ${report.competency_results.length}</strong></div>
    </section>
    <section class="context"><div><strong>${escapeHtml(report.target_role.title)}</strong><p class="muted">${escapeHtml(report.candidate_profile.headline)}</p></div><div>${renderList(report.candidate_profile.highlights, "No profile highlights supplied.")}</div></section>
    <div class="layout">
      <section><p class="eyebrow section-title">Scorecard evidence</p><div class="stack">${competencies}</div></section>
      <aside class="stack">
        <section class="card"><p class="eyebrow">What worked</p><h3>Strengths</h3>${renderList(report.strengths, "No strength was claimed without transcript evidence.")}</section>
        <section class="card"><p class="eyebrow">Focus next</p><h3>Growth areas</h3>${renderList(report.gaps, "No additional cross-competency gaps were identified.")}</section>
        <section class="card"><p class="eyebrow">Practice plan</p><h3>Exercises</h3>${exercises}</section>
        ${report.uncertainty.length ? `<section class="card"><p class="eyebrow">Limits</p><h3>What remains uncertain</h3>${renderList(report.uncertainty, "")}</section>` : ""}
      </aside>
    </div>
    <section class="section page-break"><p class="eyebrow">Interview record</p><h2>Full interview transcript</h2>${transcript}</section>
    ${delivery}
    <footer>Generated by Rocky · Evaluator ${escapeHtml(report.evaluator_version)} · ${escapeHtml(completedAt)} · Coaching guidance, not a hiring decision.</footer>
  </main>
</body>
</html>`;
}
