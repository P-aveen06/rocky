import { describe, expect, it } from "vitest";

import {
  headPoseFromMatrix,
  OffFrameTracker,
  summarizeVideoSamples,
  videoDeliveryObservations,
  type VideoFrameSample,
} from "./videoDelivery";

/** MediaPipe hands back 16 numbers in column-major order. */
function columnMajor(rows: number[][]): number[] {
  const matrix: number[] = [];
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      matrix.push(rows[row][column]);
    }
  }
  return matrix;
}

function rotationY(degrees: number): number[] {
  const radians = (degrees * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return columnMajor([
    [c, 0, s, 0],
    [0, 1, 0, 0],
    [-s, 0, c, 0],
    [0, 0, 0, 1],
  ]);
}

function sample(
  timestampMs: number,
  overrides: Partial<VideoFrameSample> = {},
): VideoFrameSample {
  return {
    timestampMs,
    yawDegrees: 0,
    pitchDegrees: 0,
    noseX: 0.5,
    noseY: 0.5,
    ...overrides,
  };
}

const ABSENT = {
  yawDegrees: null,
  pitchDegrees: null,
  noseX: null,
  noseY: null,
};

describe("headPoseFromMatrix", () => {
  it("reads square-on as zero rotation", () => {
    const pose = headPoseFromMatrix(rotationY(0));
    expect(pose?.yawDegrees).toBeCloseTo(0, 4);
    expect(pose?.pitchDegrees).toBeCloseTo(0, 4);
  });

  it("recovers a known yaw in both directions", () => {
    expect(headPoseFromMatrix(rotationY(30))?.yawDegrees).toBeCloseTo(30, 3);
    expect(headPoseFromMatrix(rotationY(-45))?.yawDegrees).toBeCloseTo(-45, 3);
  });

  it("rejects a matrix that is the wrong size rather than reading garbage", () => {
    expect(headPoseFromMatrix([1, 0, 0, 1])).toBeNull();
  });
});

describe("summarizeVideoSamples", () => {
  it("returns zeroes rather than NaN when nothing was captured", () => {
    const summary = summarizeVideoSamples([]);
    expect(summary.sampleCount).toBe(0);
    expect(summary.facePresentRatio).toBe(0);
    expect(summary.steadinessScore).toBe(0);
  });

  it("scores an attentive candidate highly", () => {
    const samples = Array.from({ length: 20 }, (_, index) =>
      sample(index * 100, { noseX: 0.5, noseY: 0.5 }),
    );
    const summary = summarizeVideoSamples(samples);

    expect(summary.facePresentRatio).toBe(1);
    expect(summary.facingCameraRatio).toBe(1);
    expect(summary.steadinessScore).toBe(1);
    expect(summary.offFrameEpisodes).toBe(0);
  });

  it("counts turning away separately from leaving the shot", () => {
    const samples = [
      sample(0, { yawDegrees: 5 }),
      sample(100, { yawDegrees: 60 }),
      sample(200, { yawDegrees: 55 }),
      sample(300, { yawDegrees: 2 }),
    ];
    const summary = summarizeVideoSamples(samples);

    expect(summary.facePresentRatio).toBe(1);
    expect(summary.facingCameraRatio).toBe(0.5);
    expect(summary.offFrameEpisodes).toBe(0);
  });

  it("ignores a brief tracking dropout but records a real absence", () => {
    const brief = [sample(0), sample(200, ABSENT), sample(400), sample(600)];
    expect(summarizeVideoSamples(brief).offFrameEpisodes).toBe(0);

    const real = [
      sample(0),
      sample(500, ABSENT),
      sample(1000, ABSENT),
      sample(4000),
    ];
    const summary = summarizeVideoSamples(real);
    expect(summary.offFrameEpisodes).toBe(1);
    expect(summary.longestOffFrameMs).toBe(3500);
  });

  it("counts an absence that never recovers before the end", () => {
    const samples = [
      sample(0),
      sample(500),
      sample(1000, ABSENT),
      sample(5000, ABSENT),
    ];
    expect(summarizeVideoSamples(samples).offFrameEpisodes).toBe(1);
  });

  it("marks a drifting head as less steady than a still one", () => {
    const still = Array.from({ length: 10 }, (_, index) =>
      sample(index * 100, { noseX: 0.5, noseY: 0.5 }),
    );
    const drifting = Array.from({ length: 10 }, (_, index) =>
      sample(index * 100, { noseX: index % 2 ? 0.3 : 0.7, noseY: 0.5 }),
    );

    expect(summarizeVideoSamples(still).steadinessScore).toBeGreaterThan(
      summarizeVideoSamples(drifting).steadinessScore,
    );
    expect(summarizeVideoSamples(drifting).steadinessScore).toBe(0);
  });

  it("does not care what order the samples arrive in", () => {
    const ordered = [sample(0), sample(100), sample(200)];
    const shuffled = [sample(200), sample(0), sample(100)];
    expect(summarizeVideoSamples(shuffled)).toEqual(
      summarizeVideoSamples(ordered),
    );
  });
});

describe("videoDeliveryObservations", () => {
  it("says nothing at all when there is no footage", () => {
    expect(videoDeliveryObservations(summarizeVideoSamples([]))).toEqual([]);
  });

  it("confirms a clean run instead of inventing a problem", () => {
    const samples = Array.from({ length: 20 }, (_, index) =>
      sample(index * 100),
    );
    const observations = videoDeliveryObservations(
      summarizeVideoSamples(samples),
    );

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatch(/stayed in frame/);
  });

  it("reports only what was observed, never an inferred state", () => {
    const samples = [
      sample(0),
      sample(1000, ABSENT),
      sample(2000, ABSENT),
      sample(6000, { yawDegrees: 70 }),
    ];
    const observations = videoDeliveryObservations(
      summarizeVideoSamples(samples),
    );

    expect(observations.join(" ")).toMatch(
      /out of frame|left the shot|turned away/,
    );
    // Delivery coaching must not put words in the candidate's head.
    expect(observations.join(" ")).not.toMatch(
      /nervous|anxious|confident|stressed|honest|uncomfortable/i,
    );
  });
});

describe("live off-frame warning", () => {
  it("ignores dropouts shorter than the tolerance", () => {
    const changes: boolean[] = [];
    const tracker = new OffFrameTracker((value) => changes.push(value), 1500);

    tracker.observe(true, 0);
    tracker.observe(false, 200);
    tracker.observe(false, 1000);
    tracker.observe(true, 1200);

    expect(changes).toEqual([]);
  });

  it("warns once the candidate has been out of shot past the tolerance", () => {
    const changes: boolean[] = [];
    const tracker = new OffFrameTracker((value) => changes.push(value), 1500);

    tracker.observe(true, 0);
    tracker.observe(false, 200);
    tracker.observe(false, 1400);
    tracker.observe(false, 1700);
    tracker.observe(false, 2000);

    expect(changes).toEqual([true]);
  });

  it("clears the warning when the candidate comes back into shot", () => {
    const changes: boolean[] = [];
    const tracker = new OffFrameTracker((value) => changes.push(value), 1500);

    tracker.observe(false, 0);
    tracker.observe(false, 1600);
    tracker.observe(true, 1800);
    tracker.observe(false, 2000);
    tracker.observe(false, 3600);

    expect(changes).toEqual([true, false, true]);
  });
});
