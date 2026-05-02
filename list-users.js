#!/usr/bin/env node
/**
 * List EEN account users.
 *
 * Reads test-credentials.json (created by get-credentials.js). If it is
 * missing, runs get-credentials.js first to create it using the .env values.
 * Then calls GET {httpsBaseUrl}/api/v3.0/users with the bearer token and
 * prints a compact table of users.
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

async function listUsers() {
  const creds = loadCredentials()
  if (!creds.accessToken) throw new Error('accessToken missing (env or test-credentials.json)')
  if (!creds.httpsBaseUrl) throw new Error('httpsBaseUrl missing (env or test-credentials.json)')

  const url = `${creds.httpsBaseUrl}/api/v3.0/users?pageSize=100`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      Accept: 'application/json'
    }
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`GET /users failed (${res.status}): ${text}`)
  const data = JSON.parse(text)
  const users = data.results || data.users || data
  if (!Array.isArray(users)) {
    console.log(JSON.stringify(data, null, 2))
    return
  }

  console.log(`Found ${users.length} user(s):`)
  for (const u of users) {
    const id = u.id || '?'
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '(no name)'
    const email = u.email || ''
    const status = u.status || ''
    console.log(`  ${id}  ${name}${email ? `  <${email}>` : ''}${status ? `  [${status}]` : ''}`)
  }
}

async function main() {
  await listUsers()
}

main().catch(err => { console.error(`Fatal: ${err.message}`); process.exit(1) })
