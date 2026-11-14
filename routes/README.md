# Website API routes

[`api.ts`](api.ts) declares LSU website endpoints. Stacks mounts this file under `/api` through the registry re-exported by [`app/Routes.ts`](../app/Routes.ts).

| Route | Purpose |
| --- | --- |
| `GET /api/live` | Normalized, cached race-board snapshot; returns 503 when no usable snapshot exists |
| `GET /api/events` | Event phases and entry windows, with shaped rows for the website |
| `GET /api/email/confirm` | Confirms the token from the newsletter double opt-in email |
| `GET /api/hello` | Starter health/example response |

For example, `route.get('/live', handler)` in `api.ts` answers `/api/live`, not `/live`. A root-level API route needs an appropriate registry prefix and, if reached through the views server, a matching proxy rule in [`config/server.ts`](../config/server.ts).

The STX files under `resources/views/` provide website pages without adding a route here. Account-only coaching URLs redirect through server configuration to the separate training app. Its authenticated routes belong to the platform kit rather than this website router.

See [the root guide](../README.md#what-runs-where) for the service boundaries and [AGENTS.md](../AGENTS.md) for the relevant routing skills.
