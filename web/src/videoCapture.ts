/**
 * Camera capture and on-device face tracking for delivery coaching.
 *
 * The stream is created here, rendered locally, and thrown away when the
 * interview ends. It is never attached to the Realtime peer connection and no
 * frame is uploaded: only the aggregate in `VideoDeliverySummary` is sent.
 */

// Type-only, so it is erased at compile time. The library itself is pulled in
// by dynamic import below, which keeps ~140kB of face tracking out of the main
// bundle for the majority of interviews that never switch the camera on.
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

import {
  headPoseFromMatrix,
  summarizeVideoSamples,
  type SummaryOptions,
  type VideoDeliverySummary,
  type VideoFrameSample,
} from "./videoDelivery";

/** Served from our own origin; the CSP forbids fetching these from a CDN. */
const WASM_DIRECTORY = "/assets/mediapipe/wasm";
const MODEL_PATH = "/assets/mediapipe/face_landmarker.task";

/** Nose tip in MediaPipe's 468-point face mesh. */
const NOSE_TIP_LANDMARK = 1;

/**
 * Five samples a second. The metrics are about seconds-long behaviour, not
 * frames, and sampling at display rate would burn battery for no extra signal.
 */
const SAMPLE_INTERVAL_MS = 200;

export class VideoCaptureError extends Error {
  constructor(
    message: string,
    readonly reason: "permission" | "unsupported" | "model",
  ) {
    super(message);
    this.name = "VideoCaptureError";
  }
}

export function isVideoCaptureSupported(): boolean {
  if (typeof navigator === "undefined" || typeof WebAssembly === "undefined") {
    return false;
  }
  // The DOM types declare mediaDevices as always present, but browsers omit it
  // entirely on insecure origins, so this has to be checked at runtime.
  const devices: MediaDevices | undefined = navigator.mediaDevices;
  return typeof devices?.getUserMedia === "function";
}

export async function requestCameraStream(): Promise<MediaStream> {
  if (!isVideoCaptureSupported()) {
    throw new VideoCaptureError(
      "This browser cannot capture video for delivery coaching.",
      "unsupported",
    );
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
      audio: false,
    });
  } catch (caught) {
    throw new VideoCaptureError(
      "Camera access was not granted, so delivery coaching will skip video.",
      caught instanceof DOMException && caught.name === "NotAllowedError"
        ? "permission"
        : "unsupported",
    );
  }
}

async function createLandmarker(): Promise<FaceLandmarker> {
  try {
    const { FaceLandmarker, FilesetResolver } =
      await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_DIRECTORY);
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: false,
    });
  } catch (caught) {
    throw new VideoCaptureError(
      `The face tracking model could not be loaded: ${
        caught instanceof Error ? caught.message : "unknown error"
      }`,
      "model",
    );
  }
}

/**
 * Samples a video element on an interval and accumulates delivery signals.
 *
 * Tracking failures are recorded as an absent face rather than thrown, so a
 * dropout mid-interview degrades the coaching instead of interrupting the
 * interview.
 */
export class VideoDeliveryRecorder {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly samples: VideoFrameSample[] = [];
  private startedAt = 0;

  private constructor(
    private readonly video: HTMLVideoElement,
    private readonly landmarker: FaceLandmarker,
    readonly stream: MediaStream,
    private readonly summaryOptions: SummaryOptions,
  ) {}

  static async create(
    video: HTMLVideoElement,
    stream: MediaStream,
    summaryOptions: SummaryOptions = {},
  ): Promise<VideoDeliveryRecorder> {
    const landmarker = await createLandmarker();
    video.srcObject = stream;
    video.muted = true;
    await video.play().catch(() => undefined);
    return new VideoDeliveryRecorder(video, landmarker, stream, summaryOptions);
  }

  start(): void {
    if (this.timer !== null) return;
    this.startedAt = performance.now();
    this.timer = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
  }

  private sample(): void {
    const timestampMs = Math.round(performance.now() - this.startedAt);
    const absent: VideoFrameSample = {
      timestampMs,
      yawDegrees: null,
      pitchDegrees: null,
      noseX: null,
      noseY: null,
    };
    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.samples.push(absent);
      return;
    }
    try {
      const result = this.landmarker.detectForVideo(
        this.video,
        performance.now(),
      );
      const matrix = result.facialTransformationMatrixes?.[0]?.data;
      const nose = result.faceLandmarks?.[0]?.[NOSE_TIP_LANDMARK];
      const pose = matrix ? headPoseFromMatrix(Array.from(matrix)) : null;
      if (!pose || !nose) {
        this.samples.push(absent);
        return;
      }
      this.samples.push({
        timestampMs,
        yawDegrees: pose.yawDegrees,
        pitchDegrees: pose.pitchDegrees,
        noseX: nose.x,
        noseY: nose.y,
      });
    } catch {
      // A single failed frame is not worth ending the interview over.
      this.samples.push(absent);
    }
  }

  /** Stops sampling, releases the camera, and returns what was observed. */
  stop(): VideoDeliverySummary {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const track of this.stream.getTracks()) track.stop();
    this.video.srcObject = null;
    this.landmarker.close();
    return summarizeVideoSamples(this.samples, this.summaryOptions);
  }
}
