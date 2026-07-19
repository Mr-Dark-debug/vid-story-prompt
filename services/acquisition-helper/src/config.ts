import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

export type RelayConfig = { serverUrl: string; deviceId: string; deviceToken: string };

export function configPath() {
  return resolve(process.env.VIDRIAL_RELAY_CONFIG ?? `${homedir()}/.vidrial/relay.json`);
}

export async function saveConfig(config: RelayConfig) {
  const target = configPath();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(target, 0o600).catch(() => undefined);
}

export async function loadConfig(): Promise<RelayConfig> {
  const value = JSON.parse(await readFile(configPath(), "utf8")) as Partial<RelayConfig>;
  if (!value.serverUrl || !value.deviceId || !value.deviceToken) {
    throw new Error("The relay configuration is incomplete. Pair this device again.");
  }
  return value as RelayConfig;
}
