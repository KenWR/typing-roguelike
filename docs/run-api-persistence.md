# Game Run API persistence

The Phaser client uses `VITE_API_BASE_URL` (default `http://localhost:3000`) and sends Run API requests with `credentials: include` so the server-owned HttpOnly anonymous player cookie remains the identity boundary. Client code never reads or logs that cookie.

## Lifecycle

- Boot: `GET /runs/active`; prefer the server snapshot when available, otherwise keep the localStorage run.
- New run: `POST /runs` with the client seed. `active_run_exists` is resolved by fetching and restoring the existing active run.
- Node entry: `PUT /runs/:runId/checkpoint` with the current `stateVersion`. `stale_state_version` is resolved by fetching the active server run and replacing the local session with the authoritative snapshot.
- Run result confirmation: `POST /runs/:runId/complete` before the local settlement flow clears the session.

## Network failure policy

Run API transport performs at most two attempts with a 2.5 second timeout per attempt. Network and 5xx failures retry once. 4xx contract errors are not blindly retried. If the API is still unavailable, gameplay continues from localStorage and the map HUD shows the local fallback state. A run that started only in local fallback remains local-only for that run rather than silently creating a different server seed later.

No request body, cookie value, anonymous player id, or full state snapshot is written to application logs by the game client.

## Browser network verification

When browser verification is available, capture the normal project screenshot evidence and verify the Network panel shows this sequence for one run: `POST /runs` (201), `PUT /runs/{id}/checkpoint` (200) after selecting a node, refresh followed by `GET /runs/active` (200), and `POST /runs/{id}/complete` (200) at settlement. Also verify failed API requests leave the run playable and the map displays the local fallback status.
