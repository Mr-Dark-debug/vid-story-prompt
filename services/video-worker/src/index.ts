import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { execa } from "execa";
import { env } from "./config/env.js";
import { logger } from "./logging/logger.js";
import { completeTask, claimTask, failTask, heartbeat, startTask } from "./queue/repository.js";
import { classifyFailure, nextAttempt } from "./queue/retry.js";
import { supabase } from "./storage/client.js";
import { handleTask } from "./tasks/handlers.js";

let stopping=false; let activeTask=false; let ready=false; const shutdown=new AbortController();
await mkdir(env.WORKER_TEMP_ROOT,{recursive:true});

async function readiness() { try { await Promise.all([execa(env.FFMPEG_PATH,["-version"],{timeout:5000}),execa(env.FFPROBE_PATH,["-version"],{timeout:5000})]); const {error}=await supabase.from("plans").select("key").limit(1); if(error)throw error; ready=true; } catch(error){ready=false;logger.error({error},"Worker readiness failed");} }

createServer((request,response)=>{if(request.url==="/healthz"){response.writeHead(200,{"content-type":"application/json"});response.end(JSON.stringify({status:"ok",workerId:env.WORKER_ID,activeTask}));return;}if(request.url==="/readyz"){response.writeHead(ready?200:503,{"content-type":"application/json"});response.end(JSON.stringify({status:ready?"ready":"not_ready"}));return;}response.writeHead(404).end();}).listen(env.PORT,()=>logger.info({port:env.PORT},"Worker health server listening"));
await readiness(); setInterval(()=>void readiness(),30_000).unref();

async function run() { while(!stopping){ try { const task=await claimTask(); if(!task){await new Promise(resolve=>setTimeout(resolve,env.QUEUE_POLL_INTERVAL_MS));continue;} activeTask=true; const context={jobId:task.clip_job_id,taskId:task.id,taskType:task.task_type,attempt:task.attempt,workerId:env.WORKER_ID}; logger.info(context,"Task leased"); await startTask(task.id); const timer=setInterval(()=>void heartbeat(task.id).catch(error=>logger.warn({...context,error},"Heartbeat failed")),Math.max(10_000,env.TASK_VISIBILITY_TIMEOUT_SECONDS*500)); try { const result=await handleTask(task,shutdown.signal); await completeTask(task.id,result); logger.info(context,"Task succeeded"); } catch(error){const failure=classifyFailure(error);await failTask(task,failure.code,failure.message,failure.retryable,failure.retryable?nextAttempt(task.attempt):null);logger[failure.retryable?"warn":"error"]({...context,errorCode:failure.code,error},"Task failed");} finally {clearInterval(timer);activeTask=false;} } catch(error){logger.error({error},"Queue poll failed");await new Promise(resolve=>setTimeout(resolve,Math.min(10_000,env.QUEUE_POLL_INTERVAL_MS*2)));} } }

for(const signal of ["SIGTERM","SIGINT"] as const)process.on(signal,()=>{logger.info({signal},"Graceful shutdown requested");stopping=true;ready=false;shutdown.abort();setTimeout(()=>process.exit(activeTask?1:0),25_000).unref();});
void run();
