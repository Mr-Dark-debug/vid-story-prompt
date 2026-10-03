// CI diagnostics for this fixed repository-authored scene only. Never accepts user source.
import { mkdtemp, mkdir, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execa } from "execa";
import { sandboxArguments } from "../dist/motion/sandbox.js";

const directory = await mkdtemp(join(tmpdir(), "motion-authored-diagnostic-"));
const name = `vidrial-motion-${randomUUID()}`;
try {
  const input = join(directory, "input"),
    output = join(directory, "output");
  await mkdir(input);
  await mkdir(output);
  await chmod(directory, 0o755);
  await chmod(output, 0o777);
  const args = sandboxArguments(
    {
      image: process.env.MOTION_DOCKER_TEST_IMAGE,
      dockerPath: "docker",
      tempRoot: directory,
      seccompProfile: resolve(process.env.MOTION_TEST_SECCOMP_PROFILE),
      memoryMb: 1024,
      cpus: 1,
      pids: 256,
      timeoutMs: 60_000,
    },
    name,
    input,
    output,
  );
  args.splice(args.length - 1, 0, "--entrypoint", "node");
  const code = `import('/renderer/motion/browser.js').then(async({openScene})=>{const scene=await openScene('<canvas width="320" height="180"></canvas><script>window.DURATION=1;window.seek=async()=>{}</script>',{width:320,height:180,fps:24,durationSeconds:1,aspect:'16:9'});await scene.close();console.log('Authored browser fixture launched')}).catch(e=>{console.error(e);process.exitCode=1})`;
  const result = await execa("docker", [...args, "-e", code], {
    reject: false,
    timeout: 60_000,
    maxBuffer: 16384,
  });
  console.log(result.stdout);
  console.error(result.stderr);
  process.exitCode = result.exitCode ?? 1;
} finally {
  await execa("docker", ["rm", "-f", name], { reject: false, timeout: 10_000 }).catch(
    () => undefined,
  );
  await rm(directory, { recursive: true, force: true });
}
