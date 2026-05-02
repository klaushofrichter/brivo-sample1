# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install
npx playwright install chromium     # one-time; required for get-credentials.js
npm run credentials                 # OAuth login → writes test-credentials.json
npm run cameras                     # GET /api/v3.0/cameras using saved token
```

There is no test suite, linter, or build step. Node 18+ is required (uses built-in `fetch`).

To watch the OAuth browser instead of running headless, set `HEADLESS=0` in `.env`.

## Architecture

Two-script flow against the Eagle Eye Networks (EEN) API. Both are ES modules (`"type": "module"`).

**`get-credentials.js`** — OAuth 2.0 authorization-code flow, fully scripted:
1. Starts a local HTTP catcher on `REDIRECT_URI` (default `http://127.0.0.1:3333`) to receive the `?code=...` redirect.
2. Launches headless Chromium via Playwright, navigates to `https://auth.eagleeyenetworks.com/oauth2/authorize`, fills email/password from `.env`.
3. POSTs the captured code to `/oauth2/token` with `CLIENT_ID` + `CLIENT_SECRET`.
4. Writes `test-credentials.json` containing `accessToken`, `refreshToken`, `httpsBaseUrl` (tenant-specific, returned by token endpoint), and `userEmail`.

The `REDIRECT_URI` must be registered on the OAuth client in the EEN developer portal.

**`list-cameras.js`** — reads `test-credentials.json` (auto-runs `get-credentials.js` via `spawnSync` if missing) and calls `GET {httpsBaseUrl}/api/v3.0/cameras?pageSize=100` with `Authorization: Bearer <accessToken>`. The `httpsBaseUrl` is per-tenant — never hardcode an EEN base URL; always read it from the credentials file.

## Important constraints

- The OAuth catcher server in `get-credentials.js` must drop sockets and the script must `process.exit(0)` on success — Playwright + keep-alive sockets otherwise hold the event loop open ~1 minute after the token is written. See the `finally` block in `getAuthCode()` and the explicit exit in `main().then(...)`.
- `test-credentials.json` and `.env` are gitignored and contain secrets. Access tokens expire in ~24 hours; rerun `npm run credentials` to refresh.

## CI / GitHub secrets

The list-cameras workflow on PRs to `production` does **not** run OAuth in CI (EEN's auth endpoint rejects the GitHub Actions IP ranges). Instead, `list-cameras.js` reads `ACCESS_TOKEN` and `HTTPS_BASE_URL` from env if set, falling back to `test-credentials.json` locally.

The `.githooks/pre-push` hook (enabled via `git config core.hooksPath .githooks`) refreshes those two repo secrets from your local `test-credentials.json` whenever you push `main`, so the PR workflow always has a fresh token. Tokens expire in ~24h; pushing again refreshes them.
