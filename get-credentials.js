#!/usr/bin/env node
/**
 * Obtain EEN credentials directly (no proxy).
 *
 * Flow:
 *   1. Playwright drives the EEN OAuth login in a headless browser.
 *   2. We intercept the redirect to REDIRECT_URI and read the ?code=... param
 *      before the browser actually loads that URL (so no server is needed).
 *   3. We POST to https://auth.eagleeyenetworks.com/oauth2/token with
 *      CLIENT_ID + CLIENT_SECRET to exchange the code for an access token.
 *   4. We write test-credentials.json in the same format as the proxy flow.
 *
 * Required in .env (or env vars):
 *   TEST_USER, TEST_PASSWORD, CLIENT_ID, CLIENT_SECRET
 *
 * Optional:
 *   REDIRECT_URI   default: http://127.0.0.1:3333
 *   SCOPE          default: vms.all
 *   HEADLESS       default: true  (set to 0/false to watch the browser)
 *
 * The REDIRECT_URI must be registered on the CLIENT_ID in the EEN portal.
 */

import { chromium } from 'playwright'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import { createServer } from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = __dirname
config({ path: resolve(ROOT_DIR, '.env') })

const {
  TEST_USER,
  TEST_PASSWORD,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI = 'http://127.0.0.1:3333',
  SCOPE = 'vms.all',
  HEADLESS = 'true'
} = process.env

const OUTPUT_FILE = resolve(ROOT_DIR, 'test-credentials.json')
const AUTH_ORIGIN = 'https://auth.eagleeyenetworks.com'

function required(name, v) {
  if (!v) { console.error(`Missing ${name} in .env`); process.exit(1) }
  return v
}
required('TEST_USER', TEST_USER)
required('TEST_PASSWORD', TEST_PASSWORD)
required('CLIENT_ID', CLIENT_ID)
required('CLIENT_SECRET', CLIENT_SECRET)

const headless = !['0', 'false', 'no'].includes(String(HEADLESS).toLowerCase())

function startCatcher(redirectUri) {
  const u = new URL(redirectUri)
  if (u.protocol !== 'http:') throw new Error(`catcher requires http:// redirect, got ${u.protocol}`)
  const port = Number(u.port || 80)
  let resolveCode, rejectCode
  const codePromise = new Promise((res, rej) => { resolveCode = res; rejectCode = rej })
  const server = createServer((req, res) => {
    const full = new URL(req.url, `http://${req.headers.host}`)
    res.writeHead(200, { 'Content-Type': 'text/html', 'Connection': 'close' })
    res.end('<html><body><h3>OAuth code received. You can close this tab.</h3></body></html>')
    const code = full.searchParams.get('code')
    const err  = full.searchParams.get('error')
    if (err) rejectCode(new Error(`OAuth error: ${err} — ${full.searchParams.get('error_description')}`))
    else if (code) resolveCode({ code, state: full.searchParams.get('state') })
  })
  const listening = new Promise((res, rej) => {
    server.once('error', rej)
    server.listen(port, u.hostname === 'localhost' ? '127.0.0.1' : u.hostname, res)
  })
  return { server, listening, codePromise }
}

async function getAuthCode() {
  const state = crypto.randomUUID()
  const authorizeUrl =
    `${AUTH_ORIGIN}/oauth2/authorize?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code&scope=${encodeURIComponent(SCOPE)}&state=${state}`

  const catcher = startCatcher(REDIRECT_URI)
  try { await catcher.listening }
  catch (e) {
    if (e.code === 'EADDRINUSE') {
      console.warn(`[catcher] port ${new URL(REDIRECT_URI).port} already in use — assuming something else will receive the redirect; will rely on URL watch only`)
    } else throw e
  }

  const browser = await chromium.launch({ headless })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(authorizeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    const email = page.locator('#authentication--input__email, input[type="email"]').first()
    try {
      await email.waitFor({ state: 'visible', timeout: 45000 })
    } catch (e) {
      const url = page.url()
      const body = (await page.content()).slice(0, 800)
      console.error(`[login] email field not visible. URL: ${url}`)
      console.error(`[login] page snippet: ${body.replace(/\s+/g, ' ')}`)
      await page.screenshot({ path: resolve(ROOT_DIR, 'debug-login.png'), fullPage: true }).catch(() => {})
      throw e
    }
    await email.fill(TEST_USER)
    await page.getByRole('button', { name: 'Next' }).click()

    const pwd = page.locator('#authentication--input__password, input[type="password"]').first()
    await pwd.waitFor({ state: 'visible', timeout: 45000 })
    await pwd.fill(TEST_PASSWORD)

    await page.locator('#next, button:has-text("Sign in"), button:has-text("Log in")').first().click()

    const { code, state: returnedState } = await Promise.race([
      catcher.codePromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout waiting for OAuth code')), 60000))
    ])
    if (returnedState !== state) throw new Error(`state mismatch: got ${returnedState}`)
    if (!code) throw new Error('no code in redirect URL')
    return code
  } finally {
    await browser.close()
    catcher.server.closeAllConnections?.()
    catcher.server.close()
  }
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: SCOPE
  })
  const res = await fetch(`${AUTH_ORIGIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`token exchange failed (${res.status}): ${text}`)
  return JSON.parse(text)
}

function normalizeBaseUrl(raw) {
  if (!raw) return undefined
  if (typeof raw === 'string') return raw
  if (raw.hostname) {
    const port = raw.port && raw.port !== 443 ? `:${raw.port}` : ''
    return `https://${raw.hostname}${port}`
  }
  return undefined
}

async function main() {
  console.log(`Starting OAuth login for ${TEST_USER} (client: ${CLIENT_ID})`)
  console.log(`Redirect URI: ${REDIRECT_URI}  (must be registered on the client)`)
  const code = await getAuthCode()
  console.log('Got authorization code; exchanging for access token...')
  const tok = await exchangeCode(code)

  const baseUrl = normalizeBaseUrl(tok.httpsBaseUrl)
  const credentials = {
    accessToken: tok.access_token || tok.accessToken,
    refreshToken: tok.refresh_token || tok.refreshToken,
    tokenType:   tok.token_type   || tok.tokenType || 'Bearer',
    expiresIn:   tok.expires_in   || tok.expiresIn,
    httpsBaseUrl: baseUrl,
    userEmail: TEST_USER
  }
  if (!credentials.accessToken) throw new Error(`no access token in response: ${JSON.stringify(tok)}`)
  if (!credentials.httpsBaseUrl) console.warn('warning: httpsBaseUrl missing from token response')

  writeFileSync(OUTPUT_FILE, JSON.stringify(credentials, null, 2))
  console.log(`Wrote ${OUTPUT_FILE}`)
  console.log(`  user:  ${credentials.userEmail}`)
  console.log(`  base:  ${credentials.httpsBaseUrl}`)
  console.log(`  exp:   ${credentials.expiresIn}s`)
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(`Fatal: ${err.message}`); process.exit(1) })
