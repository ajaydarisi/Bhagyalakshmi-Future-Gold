import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = join(root, "public", "vad");
const vadDist = join(root, "node_modules", "@ricky0123", "vad-web", "dist");
const ortDist = join(root, "node_modules", "onnxruntime-web", "dist");

if (!existsSync(vadDist) || !existsSync(ortDist)) {
  console.warn("VAD assets were not copied because their packages are not installed.");
  process.exit(0);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
for (const filename of ["vad.worklet.bundle.min.js", "silero_vad_v5.onnx"]) {
  copyFileSync(join(vadDist, filename), join(destination, filename));
}
for (const filename of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  copyFileSync(join(ortDist, filename), join(destination, filename));
}

console.log("Copied self-hosted VAD runtime assets to public/vad.");
