// @vitest-environment node
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import { sandboxArguments, withSandboxRender } from "./sandbox.js";
const image = process.env.MOTION_DOCKER_TEST_IMAGE;
const seccompProfile = process.env.MOTION_TEST_SECCOMP_PROFILE;
const spec = {
  width: 320,
  height: 180,
  fps: 24 as const,
  durationSeconds: 1,
  aspect: "16:9" as const,
};
const source = `<canvas id="c" width="320" height="180"></canvas><script>window.DURATION=1;window.seek=async t=>{const g=document.getElementById('c').getContext('2d');g.fillStyle='#1d1d1b';g.fillRect(0,0,320,180);g.fillStyle='#ef8668';g.fillRect(40+t*30,50,90,70)};</script>`;
describe.skipIf(!image || !seccompProfile)(
  "real Docker isolation (explicit operator-provided image)",
  () => {
    it("enforces nonroot, read-only root, no credentials and OS network denial", async () => {
      const directory = await mkdtemp(join(tmpdir(), "vidrial-docker-proof-"));
      try {
        const input = join(directory, "input"),
          output = join(directory, "output");
        await mkdir(input);
        await mkdir(output);
        const config = {
          image: image!,
          seccompProfile: seccompProfile!,
          dockerPath: "docker",
          tempRoot: directory,
          memoryMb: 1024,
          cpus: 1,
          pids: 256,
          timeoutMs: 60_000,
        };
        const args = sandboxArguments(config, `vidrial-motion-${randomUUID()}`, input, output);
        args.splice(args.length - 1, 0, "--entrypoint", "node");
        const assertion = `const fs=require('fs'),net=require('net');if(process.getuid()!==10001)process.exit(2);if(Object.keys(process.env).some(k=>/SUPABASE|API_KEY|TOKEN|SECRET/.test(k)))process.exit(3);try{fs.writeFileSync('/escape','x');process.exit(4)}catch(e){if(e.code!=='EROFS'&&e.code!=='EACCES')process.exit(5)}const s=net.connect({host:'1.1.1.1',port:443});s.on('connect',()=>process.exit(6));s.on('error',()=>process.exit(0));setTimeout(()=>{s.destroy();process.exit(0)},1000);`;
        const result = await execa("docker", [...args, "-e", assertion], {
          reject: false,
          timeout: 30_000,
          maxBuffer: 4096,
          windowsHide: true,
        });
        expect(result.exitCode).toBe(0);
        const manifest = await withSandboxRender(
          source,
          spec,
          true,
          config,
          async (result) => result.manifest,
        );
        expect(manifest.contract).toBe("vidrial-seek-v1");
        expect(manifest.watermarked).toBe(true);
        expect(manifest.frameCount).toBe(24);
        expect((await readdir(directory)).sort()).toEqual(["input", "output"]);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }, 90_000);
  },
);
