const canonicalOrigin = "https://vidrial.vercel.app";
const execute = process.argv.includes("--execute");
const reasonFlag = process.argv.find((argument) => argument.startsWith("--reason="));
const reason = reasonFlag?.slice("--reason=".length) || "deploy";
const acceptedReasons = new Set(["publish", "update", "delete", "deploy", "manual", "reconcile"]);

if (!acceptedReasons.has(reason)) {
  console.error(`Invalid IndexNow reason: ${reason}`);
  process.exitCode = 1;
} else {
  const endpoint = new URL("/api/indexnow/publish", canonicalOrigin).toString();

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          endpoint,
          reason,
          note: "No network request was sent. Pass --execute only after the canonical deployment is live.",
        },
        null,
        2,
      ),
    );
  } else {
    const secret = process.env.INDEXNOW_TRIGGER_SECRET;
    if (!secret || secret.length < 32) {
      console.error("INDEXNOW_TRIGGER_SECRET must contain at least 32 characters.");
      process.exitCode = 1;
    } else {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${secret}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason }),
          signal: AbortSignal.timeout(30_000),
        });
        const body = await response.text();
        if (!response.ok) {
          console.error(`IndexNow trigger failed with HTTP ${response.status}.`);
          process.exitCode = 1;
        } else {
          console.log(body);
        }
      } catch (error) {
        console.error(
          `IndexNow trigger failed: ${error instanceof Error ? error.message : "unknown error"}`,
        );
        process.exitCode = 1;
      }
    }
  }
}
