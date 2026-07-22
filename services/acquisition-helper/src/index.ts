#!/usr/bin/env node
import { hostname } from "node:os";
import { loadConfig, saveConfig } from "./config.js";
import { pairDevice, runRelay } from "./client.js";

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  if (command === "pair") {
    const serverUrl = option("server");
    const pairingToken = option("token");
    if (!serverUrl || !pairingToken) {
      throw new Error(
        "Usage: vidrial-relay pair --server https://vidrial.app --token CODE.CHALLENGE",
      );
    }
    const config = await pairDevice({
      serverUrl,
      pairingToken,
      displayName: option("name") ?? hostname(),
    });
    await saveConfig(config);
    process.stdout.write("relay=paired credentials_saved=true\n");
    return;
  }
  if (command === "run") {
    const cookiesPath = option("cookies");
    if (cookiesPath) {
      process.stderr.write(
        "warning=local_cookies_are_full_account_credentials_and_may_trigger_account_restrictions\n",
      );
    }
    await runRelay(await loadConfig(), cookiesPath);
    return;
  }
  throw new Error("Usage: vidrial-relay <pair|run>");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Relay stopped."}\n`);
  process.exitCode = 1;
});
