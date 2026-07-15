export type ClipTask = {
  id: string;
  clip_job_id: string;
  task_type: string;
  status: string;
  input_json: Record<string, unknown>;
  attempt: number;
  max_attempts: number;
  priority: number;
  lease_owner: string | null;
};
export type ConnectorTask = {
  id: string;
  connector_import_id: string;
  task_type: string;
  status: string;
  input_json: Record<string, unknown>;
  attempt: number;
  max_attempts: number;
  priority: number;
  lease_owner: string | null;
};
export type ChildTask = {
  id?: string;
  taskType: string;
  input?: Record<string, unknown>;
  dependencyGroup?: string;
  idempotencyKey: string;
  priority?: number;
  maxAttempts?: number;
};
export type TaskResult = {
  output?: Record<string, unknown>;
  children?: ChildTask[];
  jobStatus?: string;
  message?: string;
};
export type ConnectorTaskResult = { output?: Record<string, unknown>; message?: string };
export class TaskFailure extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}
