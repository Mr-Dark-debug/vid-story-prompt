param([string]$EnvironmentFile)

. (Join-Path $PSScriptRoot "common.ps1")
$repositoryEnvironment = if ([string]::IsNullOrWhiteSpace($EnvironmentFile)) {
  Join-Path $script:RepositoryRoot ".env"
} else {
  [System.IO.Path]::GetFullPath($EnvironmentFile)
}
Import-EnvironmentFile $repositoryEnvironment
Import-EnvironmentFile $script:SecretsPath

$task = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
$taskState = if ($task) { $task.State.ToString().ToLowerInvariant() } else { "not_installed" }
$workerHealth = "unreachable"
$proxyStatus = "unknown"
$workerReady = $false
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:18080/healthz" -TimeoutSec 3
  if ($health.status -eq "ok") {
    try {
      $readiness = Invoke-RestMethod -Uri "http://127.0.0.1:18080/readyz" -TimeoutSec 3
      $workerReady = $readiness.status -eq "ready"
      $workerHealth = if ($workerReady) { "ready" } else { "not_ready" }
    } catch {
      $workerHealth = "not_ready"
    }
  }
} catch {}
try {
  $headers = @{}
  $wakeSecret = [Environment]::GetEnvironmentVariable("WORKER_WAKE_SECRET", "Process")
  if (-not [string]::IsNullOrWhiteSpace($wakeSecret)) { $headers.Authorization = "Bearer $wakeSecret" }
  $proxy = Invoke-RestMethod -Uri "http://127.0.0.1:18080/health/proxy" -Headers $headers -TimeoutSec 3
  $proxyStatus = $proxy.status
} catch {}

[pscustomobject]@{
  installed = $null -ne $task
  scheduled_task = $taskState
  worker = $workerHealth
  acquisition_egress = $proxyStatus
  task_include = "download_youtube_source"
  connector_tasks = $false
  logs = $script:LogRoot
} | ConvertTo-Json
