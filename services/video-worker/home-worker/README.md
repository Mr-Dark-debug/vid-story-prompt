# Vidrial home acquisition worker

This Windows service gives only `download_youtube_source` tasks residential egress. It does not expose a public download API, accept browser-supplied storage credentials, or replace the Render worker. The Render service remains responsible for direct uploads, validation, transcription, planning, rendering, publishing, and cleanup.

The installer creates an isolated Python virtual environment under `%LOCALAPPDATA%\Vidrial\home-worker`, installs the repository-pinned yt-dlp runtime, builds the Node worker, generates loopback API secrets with a user-only ACL, and registers a limited current-user Task Scheduler task at logon. The supervisor binds both health/API ports to localhost and restarts the processes after a failure.

Prerequisites are Python 3.11+, Node 22+, Bun, and a repository `.env` containing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. No administrator shell, Docker, inbound firewall rule, public tunnel, or device-pairing step is required.

Install and start:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File services/video-worker/home-worker/install.ps1
```

For an isolated Git worktree whose `.env` remains in the primary checkout, pass
`-EnvironmentFile D:\path\to\primary-checkout\.env`; the scheduled task retains
that explicit path without copying the secret file.

Check health:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File services/video-worker/home-worker/status.ps1
```

Uninstalling preserves logs, secrets, and the virtual environment by default. Pass `-RemoveState` only when those local files should also be permanently removed.

The database capability-routing migration must be applied before this worker and the Render exclusion are enabled. Without that migration, the new worker refuses to claim tasks because its RPC is unavailable; it never falls back to the unrestricted legacy claim function.
