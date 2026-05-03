# brivo-sample1

Minimal Node.js sample that authenticates to the
[Eagle Eye Networks](https://developer.eagleeyenetworks.com/) API using OAuth 2.0
and lists the cameras on the account.

Three scripts:

- **`get-credentials.js`** — drives the EEN OAuth login in a headless Chromium
  (via Playwright), captures the redirect `?code=…`, and exchanges it for an
  access token at `https://auth.eagleeyenetworks.com/oauth2/token`. Writes
  `test-credentials.json` with `accessToken`, `refreshToken`, and `httpsBaseUrl`.
- **`list-cameras.js`** — reads credentials (see *Credential resolution* below)
  and calls `GET {httpsBaseUrl}/api/v3.0/cameras` with the bearer token,
  printing a compact list of cameras.
- **`list-users.js`** — same credential handling, calls
  `GET {httpsBaseUrl}/api/v3.0/users` and prints a compact list of account users.

## Prerequisites

- Node.js 18+ (uses built-in `fetch`)
- An EEN developer account and an OAuth client (`CLIENT_ID` / `CLIENT_SECRET`)
  with `http://127.0.0.1:3333` registered as a redirect URI. To create one, go
  to [https://developer.eagleeyenetworks.com/page/my-application](https://developer.eagleeyenetworks.com/page/my-application),
  log in with your EEN credentials, and create a new OAuth Application.
- A test user with `vms.all` scope

## Setup

```sh
npm install
npx playwright install chromium
cp .env.example .env
# edit .env with your credentials
```

`.env` fields:

| Variable | Purpose |
| --- | --- |
| `TEST_USER` | EEN account email |
| `TEST_PASSWORD` | EEN account password |
| `CLIENT_ID` | OAuth client id |
| `CLIENT_SECRET` | OAuth client secret |
| `REDIRECT_URI` | *(optional)* default `http://127.0.0.1:3333` |
| `SCOPE` | *(optional)* default `vms.all` |
| `HEADLESS` | *(optional)* `0` to watch the browser |

## Usage

```sh
npm run credentials   # one-time login → test-credentials.json
npm run cameras       # list cameras
npm run users         # list users
```

Example output:

```
Found 3 camera(s):
  1005963a  Klaus Cam 1 - Backyard Right
  100f030c  Klaus Cam 2 - Backyard Left
  1003e46b  Klaus Cam 3 - Direct

Found 2 user(s):
  abc123  Jane Doe  <jane.doe@example.com>  [active]
  def456  John Smith  <john.smith@example.com>  [active]
```

## Credential resolution

`list-cameras.js` and `list-users.js` resolve credentials in this order:

1. If both `ACCESS_TOKEN` and `HTTPS_BASE_URL` are set in the environment, use them.
2. Otherwise, read `test-credentials.json`. If that file is missing, run `get-credentials.js` first to create it.

The env-var path is what CI uses (see *CI / GitHub secrets*); the file path is what you use locally.

## CI / GitHub secrets

Two GitHub Actions workflows live under `.github/workflows/`:

- **`list-cameras.yml`** — runs on PRs targeting `production`. Installs deps and runs `list-cameras.js` using `ACCESS_TOKEN` and `HTTPS_BASE_URL` from repo secrets. Fails the check if no cameras are returned. The `production` branch protection requires this check to pass.
- **`release.yml`** — runs on push to `production`. Tags as `vYYYY.MM.DD-<short-sha>` and creates a GitHub release with auto-generated notes.

CI does **not** run the OAuth flow itself (EEN's auth endpoint rejects requests when the secrets contain the wrong values, and Playwright in CI is fragile). Instead, a local pre-push hook keeps the two CI secrets fresh.

### Pre-push hook

`.githooks/pre-push` fires when pushing `main`, refreshes `test-credentials.json` if needed (running `get-credentials.js`), and pushes `accessToken` → `ACCESS_TOKEN` and `httpsBaseUrl` → `HTTPS_BASE_URL` as GitHub repo secrets via `gh`.

Enable once per clone:

```sh
git config core.hooksPath .githooks
```

Requires `gh` CLI authenticated against the repo.

### `sync-secrets.sh`

Helper that syncs keys from `.env` into GitHub repo secrets:

```sh
./sync-secrets.sh                       # all keys in .env
./sync-secrets.sh CLIENT_ID CLIENT_SECRET   # only listed keys
```

## How it works

1. `get-credentials.js` opens
   `https://auth.eagleeyenetworks.com/oauth2/authorize?…` in headless Chromium,
   fills the login form, and starts a tiny local HTTP server on the redirect
   URI to catch the `?code=…`.
2. It POSTs the code to `/oauth2/token` with `CLIENT_ID` + `CLIENT_SECRET` and
   saves the resulting token (plus the tenant-specific `httpsBaseUrl` that
   EEN returns) to `test-credentials.json`.
3. `list-cameras.js` sends
   `GET {httpsBaseUrl}/api/v3.0/cameras?pageSize=100` with
   `Authorization: Bearer <accessToken>` and prints `id  name` for each camera
   in the response.
4. `list-users.js` sends
   `GET {httpsBaseUrl}/api/v3.0/users?pageSize=100` with
   `Authorization: Bearer <accessToken>` and prints `id  name  email  status`
   for each user in the response.

## Files

| File | Purpose |
| --- | --- |
| `get-credentials.js` | OAuth login + token exchange |
| `list-cameras.js` | Camera listing |
| `list-users.js` | User listing |
| `sync-secrets.sh` | Push `.env` keys to GitHub repo secrets via `gh` |
| `.githooks/pre-push` | Refresh + sync `ACCESS_TOKEN` / `HTTPS_BASE_URL` to GitHub when pushing `main` |
| `.github/workflows/list-cameras.yml` | PR check on `production` |
| `.github/workflows/release.yml` | Release on push to `production` |
| `.env.example` | Template for local `.env` |
| `.env` | **Not committed** — your real credentials |
| `test-credentials.json` | **Not committed** — generated access token |

## Security notes

`.env` and `test-credentials.json` are gitignored — both contain secrets.
Access tokens expire in ~24 hours; rerun `npm run credentials` to refresh.
