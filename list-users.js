#!/usr/bin/env node
import { eenGet } from './lib-creds.js'

try {
  const data = await eenGet('/api/v3.0/users?pageSize=100')
  const users = data.results || data.users || data
  if (!Array.isArray(users)) {
    console.log(JSON.stringify(data, null, 2))
    process.exit(0)
  }

  console.log(`Found ${users.length} user(s):`)
  for (const u of users) {
    const id = u.id || '?'
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '(no name)'
    const email = u.email || ''
    const status = u.status || ''
    console.log(`  ${id}  ${name}${email ? `  <${email}>` : ''}${status ? `  [${status}]` : ''}`)
  }
} catch (err) {
  console.error(`Fatal: ${err.message}`)
  process.exit(1)
}
