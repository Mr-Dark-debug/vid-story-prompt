param([string]$PostgresBin="C:\Program Files\PostgreSQL\17\bin")
$ErrorActionPreference="Stop"
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$testRoot=Join-Path $repository ("output\motion-db-"+[guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$dataPath=Join-Path $testRoot "data"
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start();$port=$listener.LocalEndpoint.Port;$listener.Stop()
$started=$false
try {
 & (Join-Path $PostgresBin "initdb.exe") -D $dataPath -U motion_test --encoding=UTF8 --no-locale -A trust
 if($LASTEXITCODE -ne 0){throw "Isolated PostgreSQL initialization failed"}
 & (Join-Path $PostgresBin "pg_ctl.exe") -D $dataPath -l (Join-Path $testRoot "postgres.log") -o "-h 127.0.0.1 -p $port" -w start
 if($LASTEXITCODE -ne 0){throw "Isolated PostgreSQL startup failed"}
 $started=$true
 $arguments=@("-h","127.0.0.1","-p","$port","-U","motion_test","-d","postgres","-v","ON_ERROR_STOP=1")
 & (Join-Path $PostgresBin "psql.exe") @arguments -f (Join-Path $repository "supabase\tests\motion-platform-fixture.sql")
 if($LASTEXITCODE -ne 0){throw "Platform fixture failed"}
 @"
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
"@ | & (Join-Path $PostgresBin "psql.exe") @arguments
 if($LASTEXITCODE -ne 0){throw "Managed default privilege fixture failed"}
 $foundationSql=Get-Content -Raw (Join-Path $repository "supabase\migrations\20260711190000_youtube_clipper_foundation.sql")
 $foundationSql.Replace("create extension if not exists pgmq with schema pgmq;","-- pgmq excluded: motion has a separate PostgreSQL queue") | & (Join-Path $PostgresBin "psql.exe") @arguments
 if($LASTEXITCODE -ne 0){throw "Application foundation failed"}
 & (Join-Path $PostgresBin "psql.exe") @arguments -f (Join-Path $repository "supabase\migrations\20261003120000_byok_ai_layer.sql") -f (Join-Path $repository "supabase\migrations\20261003130000_byok_ai_run_queue.sql")
 if($LASTEXITCODE -ne 0){throw "Existing BYOK migrations failed"}
 & (Join-Path $PostgresBin "psql.exe") @arguments -f (Join-Path $repository "supabase\migrations\20261003010000_motion_studio.sql") -f (Join-Path $repository "supabase\migrations\20261003220000_motion_public_catalog.sql") -f (Join-Path $repository "supabase\tests\motion-studio.sql")
 if($LASTEXITCODE -ne 0){throw "Motion database assertions failed"}
 & (Join-Path $PostgresBin "psql.exe") @arguments -f (Join-Path $repository "supabase\tests\ai-byok.sql") -f (Join-Path $repository "supabase\tests\ai-run-queue.sql")
 if($LASTEXITCODE -ne 0){throw "BYOK regression assertions failed after Motion Studio migration"}
 Write-Output "motion_and_byok_database_coexistence=passed"
 & node (Join-Path $repository "scripts\generate-motion-database-types.mjs") --postgres-bin $PostgresBin --port $port
 if($LASTEXITCODE -ne 0){throw "Motion schema type generation failed"}
 Write-Output "motion_database_contract_and_rls=passed"
} finally {
 if($started){ & (Join-Path $PostgresBin "pg_ctl.exe") -D $dataPath -m fast -w stop }
 Write-Output "test_artifacts=$testRoot"
}
