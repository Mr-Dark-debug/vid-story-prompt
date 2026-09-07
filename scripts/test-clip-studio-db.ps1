param(
  [string]$PostgresBin = "C:\Program Files\PostgreSQL\17\bin",
  [ValidateSet("all", "acquisition", "candidates", "accounting")][string]$Suite = "all",
  [switch]$Advisors
)

# Isolated PostgreSQL contract test. Never connects to the product database.
# Minimal tables exercise the failure RPC; this is not a full Supabase/RLS test.
$ErrorActionPreference = "Stop"
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$testRoot = Join-Path $repository ("output\clip-studio-db-" + [guid]::NewGuid().ToString("N"))
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
  if ($Suite -in @("all", "acquisition")) {
    & (Join-Path $PostgresBin "psql.exe") @arguments -f (Join-Path $repository "supabase\tests\acquisition-fixture.sql") -f (Join-Path $repository "supabase\migrations\20260906163746_acquisition_failure_reasons.sql") -f (Join-Path $repository "supabase\tests\acquisition-failures.sql")
    if ($LASTEXITCODE -ne 0) { throw "Acquisition database assertions failed" }
    Write-Output "acquisition_database_contract=passed"
  }
  if ($Suite -in @("all", "candidates")) {
    & (Join-Path $PostgresBin "psql.exe") @arguments -f (Join-Path $repository "supabase\tests\candidate-origins-fixture.sql") -f (Join-Path $repository "supabase\migrations\20260906165856_clip_candidate_origins.sql") -f (Join-Path $repository "supabase\tests\candidate-origins.sql")
    if ($LASTEXITCODE -ne 0) { throw "Candidate origin database assertions failed" }
    Write-Output "candidate_origins_database_contract=passed"
  }
  if ($Suite -in @("all", "accounting")) {
    & (Join-Path $PostgresBin "createdb.exe") -h 127.0.0.1 -p "$port" -U vidrial_test exact_cut_test
    if ($LASTEXITCODE -ne 0) { throw "Isolated accounting database creation failed" }
    $accountingArguments = @("-h", "127.0.0.1", "-p", "$port", "-U", "vidrial_test", "-d", "exact_cut_test", "-v", "ON_ERROR_STOP=1")
    & (Join-Path $PostgresBin "psql.exe") @accountingArguments -f (Join-Path $repository "supabase\tests\exact-cut-platform-fixture.sql")
    if ($LASTEXITCODE -ne 0) { throw "Test platform fixture failed" }
    # pgmq is not available in plain PostgreSQL. It is unused by these contracts;
    # retain every actual application table/policy/function from the foundation.
    $foundationSql = Get-Content -Raw (Join-Path $repository "supabase\migrations\20260711190000_youtube_clipper_foundation.sql")
    $foundationSql.Replace("create extension if not exists pgmq with schema pgmq;", "-- pgmq extension excluded in isolated contract test") | & (Join-Path $PostgresBin "psql.exe") @accountingArguments
    if ($LASTEXITCODE -ne 0) { throw "Application foundation fixture failed" }
    # Load the unchanged usage function, not unrelated pgmq initialization.
    $queueSql = Get-Content -Raw (Join-Path $repository "supabase\migrations\20260711213000_queue_worker_functions.sql")
    $commitFunction = [regex]::Match($queueSql, '(?s)create or replace function public\.commit_source_usage\(.*?\$\$;').Value
    if (-not $commitFunction) { throw "Could not locate real usage commit function" }
    $commitFunction | & (Join-Path $PostgresBin "psql.exe") @accountingArguments
    if ($LASTEXITCODE -ne 0) { throw "Usage commit function failed" }
    & (Join-Path $PostgresBin "psql.exe") @accountingArguments -f (Join-Path $repository "supabase\migrations\20260711230000_exports_retention_and_usage_release.sql") -f (Join-Path $repository "supabase\migrations\20260814020000_clipper_candidate_social_copy.sql") -f (Join-Path $repository "supabase\migrations\20260906165856_clip_candidate_origins.sql") -f (Join-Path $repository "supabase\migrations\20260906215051_exact_cut_job_accounting.sql") -f (Join-Path $repository "supabase\migrations\20260906215728_exact_cut_materialization.sql") -f (Join-Path $repository "supabase\migrations\20260907064926_exact_cut_edit_allowances.sql") -f (Join-Path $repository "supabase\tests\exact-cut-accounting.sql")
    if ($LASTEXITCODE -ne 0) { throw "Exact Cut accounting assertions failed" }
    Write-Output "exact_cut_accounting_contract=passed"
    if ($Advisors) {
      & bunx supabase db advisors --db-url "postgresql://vidrial_test@127.0.0.1:$port/exact_cut_test?sslmode=disable" --type security --level warn --fail-on error
      if ($LASTEXITCODE -ne 0) { throw "Isolated database advisors failed" }
    }
  }
} finally {
  if ($started) {
    & (Join-Path $PostgresBin "pg_ctl.exe") -D $dataPath -m fast -w stop
  }
  # Preserve this isolated cluster and logs under ignored output/ for diagnosis.
  Write-Output "test_artifacts=$testRoot"
}
