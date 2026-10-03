# NOTE: when piping this script, redirect output to a file (e.g. Start-Process -RedirectStandardOutput):
# the PostgreSQL child process inherits piped handles and keeps a pipe open until it stops.
param(
  [string]$PostgresBin = "C:\Program Files\PostgreSQL\17\bin",
  [switch]$Advisors
)

# Isolated PostgreSQL contract test for the BYOK AI layer. Never connects to the product database.
# It loads the real foundation and BYOK migrations (pgmq excluded) into a throwaway cluster with
# Supabase's default table grants emulated, then runs supabase/tests/ai-byok.sql.
# This verifies grants, RLS policies, constraints and triggers; it is not a managed-Supabase or
# Realtime test.
$ErrorActionPreference = "Stop"
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$testRoot = Join-Path $repository ("output\ai-byok-db-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$dataPath = Join-Path $testRoot "data"
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$started = $false
$psql = Join-Path $PostgresBin "psql.exe"
try {
  & (Join-Path $PostgresBin "initdb.exe") -D $dataPath -U vidrial_test --encoding=UTF8 --no-locale -A trust
  if ($LASTEXITCODE -ne 0) { throw "Isolated PostgreSQL initialization failed" }
  & (Join-Path $PostgresBin "pg_ctl.exe") -D $dataPath -l (Join-Path $testRoot "postgres.log") -o "-h 127.0.0.1 -p $port" -w start
  if ($LASTEXITCODE -ne 0) { throw "Isolated PostgreSQL startup failed" }
  $started = $true
  & (Join-Path $PostgresBin "createdb.exe") -h 127.0.0.1 -p "$port" -U vidrial_test byok_test
  if ($LASTEXITCODE -ne 0) { throw "Isolated database creation failed" }
  $arguments = @("-h", "127.0.0.1", "-p", "$port", "-U", "vidrial_test", "-d", "byok_test", "-v", "ON_ERROR_STOP=1", "-q")

  & $psql @arguments -f (Join-Path $repository "supabase\tests\exact-cut-platform-fixture.sql")
  if ($LASTEXITCODE -ne 0) { throw "Platform fixture failed" }
  # Supabase's service_role bypasses RLS, and new public tables are granted to the API roles by default; the BYOK migration's explicit
  # REVOKEs are only meaningful when that default is emulated.
  @"
alter role service_role bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
"@ | & $psql @arguments
  if ($LASTEXITCODE -ne 0) { throw "Default privilege emulation failed" }

  $foundationSql = Get-Content -Raw (Join-Path $repository "supabase\migrations\20260711190000_youtube_clipper_foundation.sql")
  $foundationSql.Replace("create extension if not exists pgmq with schema pgmq;", "-- pgmq extension excluded in isolated contract test") | & $psql @arguments
  if ($LASTEXITCODE -ne 0) { throw "Application foundation fixture failed" }

  & $psql @arguments -f (Join-Path $repository "supabase\migrations\20261003120000_byok_ai_layer.sql")
  if ($LASTEXITCODE -ne 0) { throw "BYOK migration failed" }
  & $psql @arguments -f (Join-Path $repository "supabase\tests\ai-byok.sql")
  if ($LASTEXITCODE -ne 0) { throw "BYOK database assertions failed" }
  Write-Output "ai_byok_database_contract=passed"

  if ($Advisors) {
    & bunx supabase db advisors --db-url "postgresql://vidrial_test@127.0.0.1:$port/byok_test?sslmode=disable" --type security --level warn --fail-on error
    if ($LASTEXITCODE -ne 0) { throw "Isolated database advisors failed" }
  }
} finally {
  if ($started) {
    & (Join-Path $PostgresBin "pg_ctl.exe") -D $dataPath -m fast -w stop
  }
  Write-Output "test_artifacts=$testRoot"
}
