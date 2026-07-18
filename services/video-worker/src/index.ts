import { mkdir } from "node:fs/promises";
import { execa } from "execa";
import { env } from "./config/env.js";
import { createWorkerHttpServer } from "./http/server.js";
import { logger } from "./logging/logger.js";
import {
  claimConnectorTask,
  completeConnectorTask,
  completeTask,
  claimTask,
  failConnectorTask,
  failTask,
  heartbeatConnectorTask,
  heartbeat,
  startConnectorTask,
  startTask,
} from "./queue/repository.js";
import { classifyFailure, nextAttempt } from "./queue/retry.js";
import { supabase } from "./storage/client.js";
import { handleTask } from "./tasks/handlers.js";
import { handleConnectorImport } from "./tasks/connector-import.js";
import type { ConnectorTask } from "./domain/types.js";

let stopping = false;
let activeTask = false;
let ready = false;
const shutdown = new AbortController();
await mkdir(env.WORKER_TEMP_ROOT, { recursive: true });

async function readiness() {
  try {
    const checks: Promise<unknown>[] = [
      execa(env.FFMPEG_PATH, ["-version"], { timeout: 5000 }),
      execa(env.FFPROBE_PATH, ["-version"], { timeout: 5000 }),
    ];
    if (env.YTDLP_POT_PROVIDER_URL) {
      checks.push(
        fetch(`${env.YTDLP_POT_PROVIDER_URL.replace(/\/$/, "")}/ping`, {
          signal: AbortSignal.timeout(5_000),
        }).then((response) => {
          if (!response.ok) throw new Error("PO-token provider readiness failed");
        }),
      );
    }
    await Promise.all(checks);
    const { error } = await supabase.from("plans").select("key").limit(1);
    if (error) throw error;
    ready = true;
  } catch (error) {
    ready = false;
    logger.error({ error }, "Worker readiness failed");
  }
}

createWorkerHttpServer({
  getState: () => ({ activeTask, ready }),
  wakeSecret: env.WORKER_WAKE_SECRET,
  workerId: env.WORKER_ID,
}).listen(env.PORT, "0.0.0.0", () =>
  logger.info({ port: env.PORT }, "Worker health server listening"),
);
await readiness();
setInterval(() => void readiness(), 30_000).unref();

async function processConnectorTask(task: ConnectorTask) {
  activeTask = true;
  const context = {
    connectorImportId: task.connector_import_id,
    taskId: task.id,
    taskType: task.task_type,
    attempt: task.attempt,
    workerId: env.WORKER_ID,
  };
  logger.info(context, "Connector task leased");
  await startConnectorTask(task.id);
  const timer = setInterval(
    () =>
      void heartbeatConnectorTask(task.id).catch((error) =>
        logger.warn({ ...context, error }, "Connector heartbeat failed"),
      ),
    Math.max(10_000, env.TASK_VISIBILITY_TIMEOUT_SECONDS * 500),
  );
  try {
    const result = await handleConnectorImport(task, shutdown.signal);
    await completeConnectorTask(task.id, result);
    logger.info(context, "Connector task succeeded");
  } catch (error) {
    const failure = classifyFailure(error);
    await failConnectorTask(
      task,
      failure.code,
      failure.message,
      failure.retryable,
      failure.retryable ? nextAttempt(task.attempt) : null,
    );
    logger[failure.retryable ? "warn" : "error"](
      { ...context, errorCode: failure.code, error },
      "Connector task failed",
    );
  } finally {
    clearInterval(timer);
    activeTask = false;
  }
}

async function run() {
  while (!stopping) {
    try {
      const connectorTask = await claimConnectorTask();
      if (connectorTask) {
        await processConnectorTask(connectorTask);
        continue;
      }
      const task = await claimTask();
      if (!task) {
        await new Promise((resolve) => setTimeout(resolve, env.QUEUE_POLL_INTERVAL_MS));
        continue;
      }
      activeTask = true;
      const context = {
        jobId: task.clip_job_id,
        taskId: task.id,
        taskType: task.task_type,
        attempt: task.attempt,
        workerId: env.WORKER_ID,
      };
      logger.info(context, "Task leased");
      await startTask(task.id);
      const timer = setInterval(
        () =>
          void heartbeat(task.id).catch((error) =>
            logger.warn({ ...context, error }, "Heartbeat failed"),
          ),
        Math.max(10_000, env.TASK_VISIBILITY_TIMEOUT_SECONDS * 500),
      );
      try {
        const result = await handleTask(task, shutdown.signal);
        await completeTask(task.id, result);
        logger.info(context, "Task succeeded");
      } catch (error) {
        const failure = classifyFailure(error);
        await failTask(
          task,
          failure.code,
          failure.message,
          failure.retryable,
          failure.retryable ? nextAttempt(task.attempt) : null,
        );
        logger[failure.retryable ? "warn" : "error"](
          { ...context, errorCode: failure.code, error },
          "Task failed",
        );
      } finally {
        clearInterval(timer);
        activeTask = false;
      }
    } catch (error) {
      logger.error({ error }, "Queue poll failed");
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(10_000, env.QUEUE_POLL_INTERVAL_MS * 2)),
      );
    }
  }
}

for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    logger.info({ signal }, "Graceful shutdown requested");
    stopping = true;
    ready = false;
    shutdown.abort();
    setTimeout(() => process.exit(activeTask ? 1 : 0), 25_000).unref();
  });
void run();
