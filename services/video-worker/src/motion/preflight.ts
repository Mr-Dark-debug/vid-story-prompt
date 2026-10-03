import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { sandboxArguments, withSandboxRender, type SandboxConfig } from "./sandbox.js";

/** Prove the actual host/image boundary before accepting any queued user code. */
export async function verifyMotionHost(config: SandboxConfig, signal?: AbortSignal) {
  const options = { timeout: 30_000, cancelSignal: signal, maxBuffer: 16384, windowsHide: true };
  const host = await execa(config.dockerPath, ["info", "--format", "{{.OSType}}"], options);
  if (host.stdout.trim() !== "linux") throw new Error("motion_linux_docker_required");
  const inspected = await execa(config.dockerPath, ["image", "inspect", config.image], options);
  const images = JSON.parse(inspected.stdout) as {
    Id: string;
    Config: { User: string; Env?: string[] };
  }[];
  const image = images[0];
  if (!image || !/^sha256:[a-f0-9]{64}$/.test(image.Id) || image.Config.User !== "10001:10001")
    throw new Error("motion_renderer_image_invalid");
  if (
    image.Config.Env?.some((entry) =>
      /SECRET|TOKEN|API_KEY|SUPABASE|CREDENTIAL/i.test(entry.split("=", 1)[0]),
    )
  )
    throw new Error("motion_renderer_image_has_credentials");
  // Pin this controller process to the exact verified image, even if its tag changes.
  const verified = { ...config, image: image.Id };
  const directory = await mkdtemp(join(config.tempRoot, "motion-preflight-"));
  const name = `vidrial-motion-${randomUUID()}`;
  try {
    const input = join(directory, "input"),
      output = join(directory, "output");
    await mkdir(input);
    await mkdir(output);
    const args = sandboxArguments(verified, name, input, output);
    args.splice(args.length - 1, 0, "--entrypoint", "node");
    const proof = `const fs=require('fs'),net=require('net');if(process.getuid()!==10001)process.exit(2);if(Object.keys(process.env).some(k=>/SECRET|TOKEN|API_KEY|SUPABASE|CREDENTIAL/i.test(k)))process.exit(3);try{fs.writeFileSync('/escape','x');process.exit(4)}catch(e){if(e.code!=='EROFS'&&e.code!=='EACCES')process.exit(5)}const socket=net.connect({host:'1.1.1.1',port:443});socket.on('connect',()=>process.exit(6));socket.on('error',()=>process.exit(0));setTimeout(()=>{socket.destroy();process.exit(7)},2000);`;
    await execa(config.dockerPath, [...args, "-e", proof], options);
    const source = `<canvas id="c" width="320" height="180"></canvas><script>window.DURATION=1;window.seek=async t=>{const g=document.getElementById('c').getContext('2d');g.fillStyle='#1d1d1b';g.fillRect(0,0,320,180);g.fillStyle='#ef8668';g.fillRect(40+t*30,50,90,70)};window.renderAudio=async()=>{const c=new OfflineAudioContext(1,48000,48000);const o=c.createOscillator();const g=c.createGain();g.gain.value=0.05;o.connect(g);g.connect(c.destination);o.start(0);o.stop(1);return c.startRendering()};</script>`;
    await withSandboxRender(
      source,
      { width: 320, height: 180, fps: 24, durationSeconds: 1, aspect: "16:9" },
      true,
      verified,
      async ({ manifest }) => {
        if (
          manifest.contract !== "vidrial-seek-v1" ||
          manifest.watermarked !== true ||
          manifest.frameCount !== 24 ||
          manifest.hasAudio !== true
        )
          throw new Error("motion_host_verification_failed");
      },
      signal,
    );
    return image.Id;
  } finally {
    await execa(config.dockerPath, ["rm", "-f", name], {
      ...options,
      cancelSignal: undefined,
      reject: false,
    }).catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
}
