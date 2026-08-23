Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:HomeWorkerRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$script:RepositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\.."))
$script:StateRoot = Join-Path $env:LOCALAPPDATA "Vidrial\home-worker"
$script:SecretsPath = Join-Path $script:StateRoot "secrets.env"
$script:LogRoot = Join-Path $script:StateRoot "logs"
$script:MediaRoot = Join-Path $script:StateRoot "media"
$script:VenvRoot = Join-Path $script:StateRoot "venv"
$script:ModePath = Join-Path $script:StateRoot "task-mode.txt"
$script:TaskName = "Vidrial Home Acquisition Worker"

function Set-HomeWorkerTaskMode {
  param([Parameter(Mandatory = $true)][ValidateSet("AcquisitionOnly", "FullPipeline")][string]$Mode)
  Initialize-StateDirectories
  [System.IO.File]::WriteAllText($script:ModePath, $Mode, [System.Text.UTF8Encoding]::new($false))
}

function Get-HomeWorkerTaskMode {
  if (-not (Test-Path -LiteralPath $script:ModePath)) { return "AcquisitionOnly" }
  $mode = [System.IO.File]::ReadAllText($script:ModePath).Trim()
  if ($mode -notin @("AcquisitionOnly", "FullPipeline")) {
    throw "The home worker task mode is invalid. Re-run install.ps1 to repair it."
  }
  return $mode
}

function Import-EnvironmentFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) { continue }
    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[-1] -eq '"') -or ($value[0] -eq "'" -and $value[-1] -eq "'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($name -match '^[A-Za-z_][A-Za-z0-9_]*$') {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

function New-UrlSafeSecret {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Initialize-StateDirectories {
  foreach ($path in @($script:StateRoot, $script:LogRoot, $script:MediaRoot)) {
    [System.IO.Directory]::CreateDirectory($path) | Out-Null
  }
}

function Stop-HomeWorkerProcesses {
  $pidFiles = @(
    (Join-Path $script:StateRoot "children.pid"),
    (Join-Path $script:StateRoot "supervisor.pid")
  )
  $expectedMarkers = @(
    $script:StateRoot,
    (Join-Path $script:HomeWorkerRoot "dist\index.js"),
    (Join-Path $PSScriptRoot "supervise.ps1")
  )
  $candidatePids = New-Object System.Collections.Generic.HashSet[int]
  foreach ($pidPath in $pidFiles) {
    if (-not (Test-Path -LiteralPath $pidPath)) { continue }
    foreach ($line in [System.IO.File]::ReadAllLines($pidPath)) {
      $rawPid = if ($line.Contains("=")) { $line.Split("=", 2)[1] } else { $line }
      if ($rawPid -match '^\d+$') { $candidatePids.Add([int]$rawPid) | Out-Null }
    }
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
  }
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
    $process = $_
    if ($process.ProcessId -ne $PID -and $process.CommandLine) {
      $matchesMarker = $null -ne ($expectedMarkers | Where-Object {
        $process.CommandLine.Contains($_)
      } | Select-Object -First 1)
      if ($matchesMarker) { $candidatePids.Add([int]$process.ProcessId) | Out-Null }
    }
  }
  foreach ($candidatePid in $candidatePids) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $candidatePid" -ErrorAction SilentlyContinue
    if (-not $process -or -not $process.CommandLine) { continue }
    $belongsToHomeWorker = $null -ne ($expectedMarkers | Where-Object {
      $process.CommandLine.Contains($_)
    } | Select-Object -First 1)
    if ($belongsToHomeWorker) {
      Stop-Process -Id $candidatePid -Force -ErrorAction SilentlyContinue
    }
  }
}

function Assert-RequiredServerEnvironment {
  foreach ($name in @("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) {
      throw "$name is required in the repository .env file."
    }
  }
}

function Set-HomeWorkerEnvironment {
  $ffmpeg = Join-Path $script:HomeWorkerRoot "node_modules\ffmpeg-static\ffmpeg.exe"
  $ffprobe = Join-Path $script:HomeWorkerRoot "node_modules\ffprobe-static\bin\win32\x64\ffprobe.exe"
  $python = Join-Path $script:VenvRoot "Scripts\python.exe"
  $ytdlp = Join-Path $script:VenvRoot "Scripts\yt-dlp.exe"
  foreach ($required in @($ffmpeg, $ffprobe, $python, $ytdlp)) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Required runtime is missing: $required" }
  }

  [Environment]::SetEnvironmentVariable("NODE_ENV", "development", "Process")
  [Environment]::SetEnvironmentVariable("WORKER_ID", "home-$($env:COMPUTERNAME.ToLowerInvariant())", "Process")
  [Environment]::SetEnvironmentVariable("PORT", "18080", "Process")
  [Environment]::SetEnvironmentVariable("PYTHON_ACQUISITION_PORT", "18090", "Process")
  [Environment]::SetEnvironmentVariable("PYTHON_ACQUISITION_URL", "http://127.0.0.1:18090", "Process")
  [Environment]::SetEnvironmentVariable("PYTHON_ACQUISITION_REQUIRED", "true", "Process")
  [Environment]::SetEnvironmentVariable("VIDRIAL_ACQUISITION_WEBHOOK_URL", "http://127.0.0.1:18080/internal/python-acquisition/webhook", "Process")
  [Environment]::SetEnvironmentVariable("VIDRIAL_ACQUISITION_ROOT", $script:MediaRoot, "Process")
  [Environment]::SetEnvironmentVariable("WORKER_TEMP_ROOT", $script:MediaRoot, "Process")
  $taskMode = Get-HomeWorkerTaskMode
  $taskInclude = if ($taskMode -eq "FullPipeline") { "" } else { "download_youtube_source" }
  [Environment]::SetEnvironmentVariable("WORKER_TASK_INCLUDE_TYPES", $taskInclude, "Process")
  [Environment]::SetEnvironmentVariable("WORKER_TASK_EXCLUDE_TYPES", "", "Process")
  [Environment]::SetEnvironmentVariable("WORKER_CONNECTOR_TASKS_ENABLED", "false", "Process")
  [Environment]::SetEnvironmentVariable("YTDLP_PATH", $ytdlp, "Process")
  [Environment]::SetEnvironmentVariable("CURL_PATH", (Join-Path $env:SystemRoot "System32\curl.exe"), "Process")
  [Environment]::SetEnvironmentVariable("FFMPEG_PATH", $ffmpeg, "Process")
  [Environment]::SetEnvironmentVariable("FFPROBE_PATH", $ffprobe, "Process")
  [Environment]::SetEnvironmentVariable("YTDLP_PROXY_URL", "", "Process")
  [Environment]::SetEnvironmentVariable("WARP_PROXY_URL", "", "Process")
  [Environment]::SetEnvironmentVariable("WARP_POOL_URLS", "", "Process")
  [Environment]::SetEnvironmentVariable("WARP_PROXY_HOST", "", "Process")
  [Environment]::SetEnvironmentVariable("YTDLP_STARTUP_PROBE", "true", "Process")
  [Environment]::SetEnvironmentVariable("TRUST_DIRECT_EGRESS", "true", "Process")
  [Environment]::SetEnvironmentVariable("QUEUE_POLL_INTERVAL_MS", "1500", "Process")
  [Environment]::SetEnvironmentVariable("TASK_VISIBILITY_TIMEOUT_SECONDS", "180", "Process")
  [Environment]::SetEnvironmentVariable("VIDRIAL_HOME_WORKER", "true", "Process")
}
