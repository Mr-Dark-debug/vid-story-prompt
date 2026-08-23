param([switch]$RemoveState)

. (Join-Path $PSScriptRoot "common.ps1")

Stop-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $script:TaskName -Confirm:$false -ErrorAction SilentlyContinue
Stop-HomeWorkerProcesses

if ($RemoveState -and (Test-Path -LiteralPath $script:StateRoot)) {
  $resolvedState = [System.IO.Path]::GetFullPath($script:StateRoot)
  $expectedParent = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "Vidrial"))
  if (-not $resolvedState.StartsWith($expectedParent + [System.IO.Path]::DirectorySeparatorChar)) {
    throw "Refusing to remove an unexpected state directory."
  }
  Remove-Item -LiteralPath $resolvedState -Recurse -Force
}
Write-Output "home_worker=uninstalled state_removed=$($RemoveState.IsPresent)"
