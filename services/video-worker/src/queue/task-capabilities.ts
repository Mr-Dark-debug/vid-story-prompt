const taskTypePattern = /^[a-z][a-z0-9_]{1,63}$/;

function parseList(value: string | undefined, label: string): string[] | null {
  if (!value?.trim()) return null;
  const items = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  if (items.length === 0) return null;
  const invalid = items.find((item) => !taskTypePattern.test(item));
  if (invalid) throw new Error(`${label} contains an invalid task type: ${invalid}`);
  return items.sort();
}

export type TaskCapabilities = {
  include: string[] | null;
  exclude: string[];
};

export function parseTaskCapabilities(
  includeValue: string | undefined,
  excludeValue: string | undefined,
): TaskCapabilities {
  const include = parseList(includeValue, "WORKER_TASK_INCLUDE_TYPES");
  const exclude = parseList(excludeValue, "WORKER_TASK_EXCLUDE_TYPES") ?? [];
  const overlap = include?.find((taskType) => exclude.includes(taskType));
  if (overlap) throw new Error(`Worker task capability lists overlap at: ${overlap}`);
  return { include, exclude };
}
