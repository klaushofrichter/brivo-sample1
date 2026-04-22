# brivo-sample1

Minimal Node.js sample that authenticates to the
[Eagle Eye Networks](https://developer.eagleeyenetworks.com/) API using OAuth 2.0
and lists the cameras on the account.

Two scripts:

- **`get-credentials.js`** — drives the EEN OAuth login in a headless Chromium
  (via Playwright), captures the redirect `?code=…`, and exchanges it for an
  access token at `https://auth.eagleeyenetworks.com/oauth2/token`. Writes
  `test-credentials.json` with `accessToken`, `refreshToken`, and `httpsBaseUrl`.
- **`list-cameras.js`** — reads `test-credentials.json` (runs
  `get-credentials.js` first if missing) and calls
  `GET {httpsBaseUrl}/api/v3.0/cameras` with the bearer token, printing a
  compact list of cameras.

## Prerequisites

- Node.js 18+ (uses built-in `fetch`)
- An EEN developer account and an OAuth client (`CLIENT_ID` / `CLIENT_SECRET`)
  with `http://127.0.0.1:3333` registered as a redirect URI
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
```

Example output:

```
Found 3 camera(s):
  1005963a  Klaus Cam 1 - Backyard Right
  100f030c  Klaus Cam 2 - Backyard Left
  1003e46b  Klaus Cam 3 - Direct
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

## Files

| File | Purpose |
| --- | --- |
| `get-credentials.js` | OAuth login + token exchange |
| `list-cameras.js` | Camera listing |
| `.env.example` | Template for local `.env` |
| `.env` | **Not committed** — your real credentials |
| `test-credentials.json` | **Not committed** — generated access token |

## Security notes

`.env` and `test-credentials.json` are gitignored — both contain secrets.
Access tokens expire in ~24 hours; rerun `npm run credentials` to refresh.
