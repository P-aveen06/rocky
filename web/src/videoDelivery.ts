/**
 * Observable on-camera delivery signals, computed entirely in the browser.
 *
 * Deliberately limited to things a person can see and act on: were you in
 * shot, were you facing the camera, were you holding still. It does not infer
 * emotion, confidence, stress or honesty. Those readings are contested even in
 * the research, and like the rest of delivery coaching they must never reach a
 * role-fit score.
 *
 * No frame ever leaves the device. Only the aggregate numbers below are sent.
 */

/** One sampled frame. Nulls mean no face was found in that frame. */
export interface VideoFrameSample {
  timestampMs: number;
  /** Head rotation in degrees; 0 is square-on to the camera. */
  yawDegrees: number | null;
  pitchDegrees: number | null;
  /** Nose tip, normalised 0..1 across the frame. */
  noseX: number | null;
  noseY: number | null;
}

export interface VideoDeliverySummary {
  sampleCount: number;
  durationMs: number;
  /** Share of samples where a face was found at all. */
  facePresentRatio: number;
  /** Of the samples with a face, the share roughly square-on to the camera. */
  facingCameraRatio: number;
  /** 0..1, higher is steadier. Derived from how far the head drifts. */
  steadinessScore: number;
  /** Runs of at least `offFrameToleranceMs` with no face at all. */
  offFrameEpisodes: number;
  longestOffFrameMs: number;
}

export interface SummaryOptions {
  /** Beyond this rotation the candidate is looking away rather than at camera. */
  facingToleranceDegrees?: number;
  /** Brief dropouts are tracking noise, not the candidate leaving the shot. */
  offFrameToleranceMs?: number;
}

const DEFAULT_FACING_TOLERANCE_DEGREES = 22;
const DEFAULT_OFF_FRAME_TOLERANCE_MS = 1500;

/**
 * Recover head yaw and pitch from MediaPipe's facial transformation matrix.
 *
 * The matrix arrives as 16 numbers in column-major order, so the value at row
 * `r` and column `c` is `matrix[c * 4 + r]`.
 */
export function headPoseFromMatrix(
  matrix: readonly number[],
): { yawDegrees: number; pitchDegrees: number } | null {
  if (matrix.length < 16) return null;
  const at = (row: number, column: number) => matrix[column * 4 + row];

  // Standard extraction for an X-then-Y rotation order.
  const forwardX = at(2, 0);
  const forwardY = at(2, 1);
  const forwardZ = at(2, 2);
  const horizon = Math.hypot(forwardY, forwardZ);
  if (!Number.isFinite(horizon) || (horizon === 0 && forwardX === 0))
    return null;

  const yaw = Math.atan2(-forwardX, horizon);
  const pitch = Math.atan2(forwardY, forwardZ);
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;

  const degrees = (radians: number) => (radians * 180) / Math.PI;
  return { yawDegrees: degrees(yaw), pitchDegrees: degrees(pitch) };
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean =
    values.reduce((total, value) => total + value, 0) / values.length;
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Reduce sampled frames to the handful of numbers worth reporting.
 *
 * Pure on purpose: the camera and the model are impossible to exercise in a
 * test, but the arithmetic that decides what the candidate is told is not.
 */
export function summarizeVideoSamples(
  samples: readonly VideoFrameSample[],
  options: SummaryOptions = {},
): VideoDeliverySummary {
  const facingTolerance =
    options.facingToleranceDegrees ?? DEFAULT_FACING_TOLERANCE_DEGREES;
  const offFrameTolerance =
    options.offFrameToleranceMs ?? DEFAULT_OFF_FRAME_TOLERANCE_MS;

  const empty: VideoDeliverySummary = {
    sampleCount: 0,
    durationMs: 0,
    facePresentRatio: 0,
    facingCameraRatio: 0,
    steadinessScore: 0,
    offFrameEpisodes: 0,
    longestOffFrameMs: 0,
  };
  if (samples.length === 0) return empty;

  const ordered = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);
  const durationMs =
    ordered[ordered.length - 1].timestampMs - ordered[0].timestampMs;

  const present = ordered.filter((sample) => sample.yawDegrees !== null);
  const facing = present.filter(
    (sample) =>
      Math.abs(sample.yawDegrees as number) <= facingTolerance &&
      Math.abs(sample.pitchDegrees ?? 0) <= facingTolerance,
  );

  // Head drift, measured as spread of the nose across the frame. A tenth of the
  // frame of movement is treated as fully unsteady, which keeps ordinary
  // gesturing from reading as fidgeting.
  const drift =
    (standardDeviation(
      present.map((sample) => sample.noseX as number).filter(Number.isFinite),
    ) +
      standardDeviation(
        present.map((sample) => sample.noseY as number).filter(Number.isFinite),
      )) /
    2;
  const steadiness = present.length < 2 ? 0 : Math.max(0, 1 - drift / 0.1);

  let offFrameEpisodes = 0;
  let longestOffFrameMs = 0;
  let gapStart: number | null = null;
  for (const sample of ordered) {
    if (sample.yawDegrees === null) {
      gapStart ??= sample.timestampMs;
      continue;
    }
    if (gapStart !== null) {
      const gap = sample.timestampMs - gapStart;
      if (gap >= offFrameTolerance) {
        offFrameEpisodes += 1;
        longestOffFrameMs = Math.max(longestOffFrameMs, gap);
      }
      gapStart = null;
    }
  }
  if (gapStart !== null) {
    const gap = ordered[ordered.length - 1].timestampMs - gapStart;
    if (gap >= offFrameTolerance) {
      offFrameEpisodes += 1;
      longestOffFrameMs = Math.max(longestOffFrameMs, gap);
    }
  }

  return {
    sampleCount: ordered.length,
    durationMs,
    facePresentRatio: round(present.length / ordered.length),
    facingCameraRatio:
      present.length === 0 ? 0 : round(facing.length / present.length),
    steadinessScore: round(steadiness),
    offFrameEpisodes,
    longestOffFrameMs,
  };
}

/**
 * Turn a summary into the plain observations a candidate can act on.
 *
 * Phrased as what was seen, never as what it supposedly means about them.
 */
export function videoDeliveryObservations(
  summary: VideoDeliverySummary,
): string[] {
  const observations: string[] = [];
  if (summary.sampleCount === 0) return observations;

  if (summary.facePresentRatio < 0.9) {
    observations.push(
      `You were out of frame for about ${Math.round((1 - summary.facePresentRatio) * 100)}% of the interview.`,
    );
  }
  if (summary.offFrameEpisodes > 0) {
    observations.push(
      `You left the shot ${summary.offFrameEpisodes} time${summary.offFrameEpisodes === 1 ? "" : "s"}, the longest for ${Math.round(summary.longestOffFrameMs / 1000)}s.`,
    );
  }
  if (summary.facingCameraRatio < 0.7) {
    observations.push(
      `You were turned away from the camera for about ${Math.round((1 - summary.facingCameraRatio) * 100)}% of the time your face was visible.`,
    );
  }
  if (summary.steadinessScore < 0.5) {
    observations.push(
      "Your head moved around a fair amount. Steadying up reads as more composed on camera.",
    );
  }
  if (observations.length === 0) {
    observations.push(
      "You stayed in frame, facing the camera, and held steady throughout.",
    );
  }
  return observations;
}
