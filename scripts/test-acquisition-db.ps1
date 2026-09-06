param([string]$PostgresBin = "C:\Program Files\PostgreSQL\17\bin")

# Isolated PostgreSQL contract test. Never connects to the product database.
# Minimal tables exercise the failure RPC; this is not a full Supabase/RLS test.
$ErrorActionPreference = "Stop"
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$testRoot = Join-Path $repository ("output\acquisition-db-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$dataPath = Join-Path $testRoot "data"
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$started = $false
try {
  & (Join-Path $PostgresBin "initdb.exe") -D $dataPath -U vidrial_test --encoding=UTF8 --no-locale -A trust
  if ($LASTEXITCODE -ne 0) { throw "Isolated PostgreSQL initialization failed" }
  & (Join-Path $PostgresBin "pg_ctl.exe") -D $dataPath -l (Join-Path $testRoot "postgres.log") -o "-h 127.0.0.1 -p $port" -w start
  if ($LASTEXITCODE -ne 0) { throw "Isolated PostgreSQL startup failed" }
  $started = $true
  $arguments = @("-h", "127.0.0.1", "-p", "$port", "-U", "vidrial_test", "-d", "postgres", "-v", "ON_ERROR_STOP=1")
  & (Join-Path $PostgresBin "psql.exe") @arguments -f (Join-Path $repository "supabase\tests\acquisition-fixture.sql") -f (Join-Path $repository "supabase\migrations\20260906163746_acquisition_failure_reasons.sql") -f (Join-Path $repository "supabase\tests\acquisition-failures.sql")
  if ($LASTEXITCODE -ne 0) { throw "Acquisition database assertions failed" }
  Write-Output "acquisition_database_contract=passed"
} finally {
  if ($started) {
    & (Join-Path $PostgresBin "pg_ctl.exe") -D $dataPath -m fast -w stop
  }
  # Preserve this isolated cluster and logs under ignored output/ for diagnosis.
  Write-Output "test_artifacts=$testRoot"
}
