import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../config/env.js";
import { TaskFailure, type ClipTask } from "../domain/types.js";
import { downloadAsset, supabase } from "../storage/client.js";

export async function withTaskDirectory<T>(task: ClipTask, run: (directory: string) => Promise<T>) { const directory = await mkdtemp(join(env.WORKER_TEMP_ROOT,`${task.id}-`)); try { return await run(directory); } finally { await rm(directory,{ recursive:true,force:true }); } }
export async function getJob(jobId: string) { const { data,error } = await supabase.from("clip_jobs").select("*").eq("id",jobId).single(); if (error) throw error; if (["cancelled","expiring","expired"].includes(data.status)) throw new TaskFailure("cancelled","The job was cancelled or expired.",false); return data; }
export async function getAsset(assetId: string) { const { data,error } = await supabase.from("media_assets").select("*").eq("id",assetId).single(); if (error) throw error; return data; }
export async function downloadJobSource(jobId: string, directory: string) { const job = await getJob(jobId); if (!job.source_asset_id) throw new TaskFailure("missing_source","The job has no source asset.",false); const asset = await getAsset(job.source_asset_id); if (!asset.storage_bucket || !asset.storage_path) throw new TaskFailure("missing_source","The source object is missing.",false); const target = join(directory,"source-media"); await downloadAsset(asset.storage_bucket,asset.storage_path,target); return { job,asset,target }; }
export async function sha256(file: string) { const hash=createHash("sha256"); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest("hex"); }
export const immutablePath = (job: { workspace_id:string; user_id:string; id:string },kind:string,extension:string) => `${job.workspace_id}/${job.user_id}/${job.id}/${kind}/${randomUUID()}.${extension}`;
