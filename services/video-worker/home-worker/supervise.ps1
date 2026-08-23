param([string]$EnvironmentFile)

. (Join-Path $PSScriptRoot "common.ps1")
Initialize-StateDirectories
$repositoryEnvironment = if ([string]::IsNullOrWhiteSpace($EnvironmentFile)) {
  Join-Path $script:RepositoryRoot ".env"
} else {
  [System.IO.Path]::GetFullPath($EnvironmentFile)
}
Import-EnvironmentFile $repositoryEnvironment
Import-EnvironmentFile $script:SecretsPath
Assert-RequiredServerEnvironment
Set-HomeWorkerEnvironment

$python = Join-Path $script:VenvRoot "Scripts\python.exe"
$pythonAppRoot = Join-Path $script:HomeWorkerRoot "python-acquisition"
$workerEntry = Join-Path $script:HomeWorkerRoot "dist\index.js"
$supervisorPidPath = Join-Path $script:StateRoot "supervisor.pid"
[System.IO.File]::WriteAllText($supervisorPidPath, "$PID")

try {
  while ($true) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $pythonOut = Join-Path $script:LogRoot "python-$stamp.log"
    $pythonErr = Join-Path $script:LogRoot "python-$stamp.error.log"
    $workerOut = Join-Path $script:LogRoot "worker-$stamp.log"
    $workerErr = Join-Path $script:LogRoot "worker-$stamp.error.log"

    $pythonProcess = Start-Process -FilePath $python -ArgumentList @(
      "-m", "uvicorn", "app.main:app", "--app-dir", $pythonAppRoot,
      "--host", "127.0.0.1", "--port", "18090", "--no-access-log"
    ) -PassThru -WindowStyle Hidden -RedirectStandardOutput $pythonOut -RedirectStandardError $pythonErr

    $healthy = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      if ($pythonProcess.HasExited) { break }
      try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:18090/healthz" -TimeoutSec 2
        if ($response.status -eq "ok") { $healthy = $true; break }
      } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $healthy) {
      if (-not $pythonProcess.HasExited) { Stop-Process -Id $pythonProcess.Id -Force }
      Start-Sleep -Seconds 10
      continue
    }

    $workerProcess = Start-Process -FilePath "node.exe" -ArgumentList @($workerEntry) -WorkingDirectory $script:HomeWorkerRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $workerOut -RedirectStandardError $workerErr
    [System.IO.File]::WriteAllLines((Join-Path $script:StateRoot "children.pid"), @("python=$($pythonProcess.Id)", "worker=$($workerProcess.Id)"))
    Wait-Process -Id $workerProcess.Id
    if (-not $pythonProcess.HasExited) { Stop-Process -Id $pythonProcess.Id -Force }
    Remove-Item -LiteralPath (Join-Path $script:StateRoot "children.pid") -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 10
  }
} finally {
  Remove-Item -LiteralPath $supervisorPidPath -Force -ErrorAction SilentlyContinue
}
