param(
  [string]$EnvironmentFile,
  [switch]$NoStart
)

. (Join-Path $PSScriptRoot "common.ps1")
Initialize-StateDirectories
Stop-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
Stop-HomeWorkerProcesses

foreach ($command in @("python", "bun", "node")) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "$command is required to install the Vidrial home acquisition worker."
  }
}

$repositoryEnvironment = if ([string]::IsNullOrWhiteSpace($EnvironmentFile)) {
  Join-Path $script:RepositoryRoot ".env"
} else {
  [System.IO.Path]::GetFullPath($EnvironmentFile)
}
if (-not (Test-Path -LiteralPath $repositoryEnvironment)) {
  throw "The server environment file does not exist: $repositoryEnvironment"
}
Import-EnvironmentFile $repositoryEnvironment
Assert-RequiredServerEnvironment

if (-not (Test-Path -LiteralPath (Join-Path $script:VenvRoot "Scripts\python.exe"))) {
  & python -m venv $script:VenvRoot
  if ($LASTEXITCODE -ne 0) { throw "Unable to create the private Python environment." }
}

$venvPython = Join-Path $script:VenvRoot "Scripts\python.exe"
& $venvPython -m ensurepip --upgrade
if ($LASTEXITCODE -ne 0) { throw "Unable to bootstrap pip in the private Python environment." }
& $venvPython -m pip install --disable-pip-version-check --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Unable to update pip." }
& $venvPython -m pip install --disable-pip-version-check -r (Join-Path $script:HomeWorkerRoot "python-acquisition\requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Unable to install the Python acquisition dependencies." }

Push-Location $script:HomeWorkerRoot
try {
  & bun install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "Unable to install the locked worker dependencies." }
  & bun run build
  if ($LASTEXITCODE -ne 0) { throw "Unable to build the worker." }
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $script:SecretsPath)) {
  $lines = @(
    "PYTHON_ACQUISITION_TOKEN=$(New-UrlSafeSecret)",
    "VIDRIAL_ACQUISITION_WEBHOOK_SECRET=$(New-UrlSafeSecret)",
    "WORKER_WAKE_SECRET=$(New-UrlSafeSecret)"
  )
  [System.IO.File]::WriteAllLines($script:SecretsPath, $lines, [System.Text.UTF8Encoding]::new($false))
} elseif (-not (Select-String -LiteralPath $script:SecretsPath -Pattern '^WORKER_WAKE_SECRET=' -Quiet)) {
  Add-Content -LiteralPath $script:SecretsPath -Value "WORKER_WAKE_SECRET=$(New-UrlSafeSecret)"
}
& icacls.exe $script:SecretsPath /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null

$supervisor = Join-Path $PSScriptRoot "supervise.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$supervisor`" -EnvironmentFile `"$repositoryEnvironment`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $script:TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

if (-not $NoStart) { Start-ScheduledTask -TaskName $script:TaskName }
Write-Output "home_worker=installed task=$($script:TaskName) state=$($script:StateRoot)"
