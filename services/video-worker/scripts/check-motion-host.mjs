import { mkdir } from "node:fs/promises";
import { env } from "../dist/config/env.js";
import { motionSandboxConfig } from "../dist/tasks/motion-render.js";
import { verifyMotionHost } from "../dist/motion/preflight.js";

try {
  await mkdir(env.WORKER_TEMP_ROOT, { recursive: true });
  const started = performance.now();
  const image = await verifyMotionHost(motionSandboxConfig());
  console.log(
    JSON.stringify({
      verified: true,
      image,
      elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)),
    }),
  );
} catch {
  console.error(
    "Motion host verification failed. Check Linux Docker, image, seccomp, user namespaces and available resources. No jobs were claimed.",
  );
  process.exitCode = 1;
}
