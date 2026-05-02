#!/usr/bin/env node
/**
 * List EEN cameras.
 *
 * Reads test-credentials.json (created by get-credentials.js). If it is
 * missing, runs get-credentials.js first to create it using the .env values.
 * Then calls GET {httpsBaseUrl}/api/v3.0/cameras with the bearer token and
 * prints a compact table of cameras.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CREDS_FILE = resolve(__dirname, 'test-credentials.json')

function loadCredentials() {
  if (process.env.ACCESS_TOKEN && process.env.HTTPS_BASE_URL) {
    return {
      accessToken: process.env.ACCESS_TOKEN,
      httpsBaseUrl: process.env.HTTPS_BASE_URL
    }
  }
  if (!existsSync(CREDS_FILE)) {
    console.log('test-credentials.json not found — running get-credentials.js...')
    const r = spawnSync(process.execPath, [resolve(__dirname, 'get-credentials.js')], {
      stdio: 'inherit'
    })
    if (r.status !== 0) {
      console.error('get-credentials.js failed')
      process.exit(r.status || 1)
    }
  }
  return JSON.parse(readFileSync(CREDS_FILE, 'utf8'))
}

async function listCameras() {
  const creds = loadCredentials()
  if (!creds.accessToken) throw new Error('accessToken missing (env or test-credentials.json)')
  if (!creds.httpsBaseUrl) throw new Error('httpsBaseUrl missing (env or test-credentials.json)')

  const url = `${creds.httpsBaseUrl}/api/v3.0/cameras?pageSize=100`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      Accept: 'application/json'
    }
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`GET /cameras failed (${res.status}): ${text}`)
  const data = JSON.parse(text)
  const cameras = data.results || data.cameras || data
  if (!Array.isArray(cameras)) {
    console.log(JSON.stringify(data, null, 2))
    return
  }

  console.log(`Found ${cameras.length} camera(s):`)
  for (const c of cameras) {
    const id = c.id || c.cameraId || '?'
    const name = c.name || '(no name)'
    const status = c.status?.connectionStatus || c.status || ''
    console.log(`  ${id}  ${name}${status ? `  [${status}]` : ''}`)
  }
}

async function main() {
  await listCameras()
}

main().catch(err => { console.error(`Fatal: ${err.message}`); process.exit(1) })
