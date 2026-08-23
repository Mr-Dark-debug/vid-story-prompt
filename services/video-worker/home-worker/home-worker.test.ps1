. (Join-Path $PSScriptRoot "common.ps1")

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

$expectedStateParent = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "Vidrial"))
$resolvedState = [System.IO.Path]::GetFullPath($script:StateRoot)
Assert-True ($resolvedState.StartsWith($expectedStateParent + [System.IO.Path]::DirectorySeparatorChar)) "State must stay below the Vidrial user directory."

$firstSecret = New-UrlSafeSecret
$secondSecret = New-UrlSafeSecret
Assert-True ($firstSecret.Length -ge 40) "Generated secrets must retain at least 256 bits of entropy."
Assert-True ($firstSecret -ne $secondSecret) "Generated secrets must not repeat."
Assert-True ($firstSecret -match '^[A-Za-z0-9_-]+$') "Generated secrets must be URL-safe."

$temporaryEnvironment = Join-Path ([System.IO.Path]::GetTempPath()) "vidrial-home-worker-env-$([guid]::NewGuid()).env"
try {
  [System.IO.File]::WriteAllLines($temporaryEnvironment, @(
    "# ignored",
    "VIDRIAL_HOME_WORKER_TEST=loaded",
    "INVALID-NAME=ignored"
  ))
  Import-EnvironmentFile $temporaryEnvironment
  Assert-True ($env:VIDRIAL_HOME_WORKER_TEST -eq "loaded") "Environment parsing failed."
  Assert-True ($null -eq [Environment]::GetEnvironmentVariable("INVALID-NAME", "Process")) "Invalid environment names must be ignored."
} finally {
  Remove-Item -LiteralPath $temporaryEnvironment -Force -ErrorAction SilentlyContinue
  Remove-Item Env:VIDRIAL_HOME_WORKER_TEST -ErrorAction SilentlyContinue
}

Write-Output "home_worker_tests=passed"
