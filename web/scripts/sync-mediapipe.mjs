// Copies the MediaPipe WASM runtime out of node_modules and into public/, where
// Vite serves it from our own origin.
//
// It cannot be loaded from a CDN: the Content-Security-Policy allows scripts and
// connections from 'self' only. Committing ~21MB of binaries would bloat every
// clone, and the files are already pinned by package-lock, so they are copied at
// build time instead. The model itself is committed, because downloading it
// would make every deploy depend on a third-party host staying up.

import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(
  here,
  "..",
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm",
);
const target = join(here, "..", "public", "assets", "mediapipe", "wasm");

// Both variants ship: MediaPipe picks at runtime and falls back to nosimd on
// browsers without WASM SIMD.
const files = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

if (!existsSync(source)) {
  console.error(
    "MediaPipe wasm not found. Run npm install before building.\n" +
      `  looked in: ${source}`,
  );
  process.exit(1);
}

mkdirSync(target, { recursive: true });
for (const file of files) {
  copyFileSync(join(source, file), join(target, file));
}
console.log(
  `mediapipe: synced ${files.length} runtime files to public/assets/mediapipe/wasm`,
);
