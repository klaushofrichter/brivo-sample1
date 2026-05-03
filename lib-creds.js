import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const ROOT = dirname(fileURLToPath(import.meta.url))
const CREDS_FILE = resolve(ROOT, 'test-credentials.json')

export function loadCredentials() {
  if (process.env.ACCESS_TOKEN && process.env.HTTPS_BASE_URL) {
    return {
      accessToken: process.env.ACCESS_TOKEN,
      httpsBaseUrl: process.env.HTTPS_BASE_URL
    }
  }
  let raw
  try {
    raw = readFileSync(CREDS_FILE, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
    console.log('test-credentials.json not found — running get-credentials.js...')
    const r = spawnSync(process.execPath, [resolve(ROOT, 'get-credentials.js')], { stdio: 'inherit' })
    if (r.status !== 0) {
      console.error('get-credentials.js failed')
      process.exit(r.status || 1)
    }
    raw = readFileSync(CREDS_FILE, 'utf8')
  }
  const creds = JSON.parse(raw)
  if (!creds.accessToken) throw new Error('accessToken missing (env or test-credentials.json)')
  if (!creds.httpsBaseUrl) throw new Error('httpsBaseUrl missing (env or test-credentials.json)')
  return creds
}

export async function eenRequest(method, path, body) {
  const creds = loadCredentials()
  const headers = {
    Authorization: `Bearer ${creds.accessToken}`,
    Accept: 'application/json'
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${creds.httpsBaseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${text}`)
  return text ? JSON.parse(text) : {}
}

export const eenGet = (path) => eenRequest('GET', path)
export const eenPatch = (path, body) => eenRequest('PATCH', path, body)
