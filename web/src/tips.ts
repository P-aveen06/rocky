/**
 * General interview tips shown while a slow setup step runs.
 *
 * These are deliberately role-agnostic: they surface before the target role is
 * known (résumé extraction happens first), so anything domain-specific would be
 * wrong as often as it is right. Keep each tip short enough to read in the few
 * seconds it stays on screen.
 */
export interface InterviewTip {
  title: string;
  body: string;
}

export const INTERVIEW_TIPS: InterviewTip[] = [
  {
    title: "Lead with the outcome",
    body: "Open an answer with what changed, then explain how you got there. Interviewers can follow the detail once they know where it lands.",
  },
  {
    title: "Keep a story spine",
    body: "Situation, the decision you owned, what you did, the result. Four beats is usually enough — most answers run long, not short.",
  },
  {
    title: "Name your own contribution",
    body: "“We” hides the part being assessed. Say what you personally decided, built, or convinced someone of.",
  },
  {
    title: "Bring one number",
    body: "A time saved, a cost avoided, a volume handled. One concrete figure makes an entire story credible.",
  },
  {
    title: "Say the trade-off out loud",
    body: "Every real decision cost something. Naming what you gave up shows judgement more than a clean success story does.",
  },
  {
    title: "Ask before you answer",
    body: "One clarifying question about scope or constraints is not a stall — it is how the job is actually done.",
  },
  {
    title: "Pause instead of filling",
    body: "Two seconds of silence sounds thoughtful. Two seconds of “um” does not. Take the beat.",
  },
  {
    title: "Prepare four stories, not forty",
    body: "A hard problem, a conflict, a failure, a thing you shipped. Most questions are one of these wearing a different hat.",
  },
  {
    title: "Failure answers need the repair",
    body: "Pick something that genuinely went wrong, then spend most of the answer on what you changed afterwards.",
  },
  {
    title: "Match the question's altitude",
    body: "If they asked “why”, don't answer “how”. Give the reasoning first and offer the detail if they want it.",
  },
  {
    title: "Show how you handle pushback",
    body: "When an interviewer challenges you, engage with the point. Changing your mind for a good reason reads as strength.",
  },
  {
    title: "Check they got what they needed",
    body: "“Is that the level of detail you wanted?” costs five seconds and rescues a lot of misread questions.",
  },
  {
    title: "Your questions are part of the answer",
    body: "Ask about how decisions get made or what the first ninety days look like — it signals you're evaluating the role too.",
  },
  {
    title: "Practice out loud",
    body: "A story that reads well silently often falls apart when spoken. Rehearsing aloud is the whole point of this session.",
  },
];

/**
 * Deterministic per-call rotation start so consecutive loading states don't
 * always open on the same tip.
 */
export function shuffledTips(): InterviewTip[] {
  const tips = [...INTERVIEW_TIPS];
  for (let index = tips.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [tips[index], tips[swap]] = [tips[swap], tips[index]];
  }
  return tips;
}
