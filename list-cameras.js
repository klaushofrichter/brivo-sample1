#!/usr/bin/env node
import { eenGet } from './lib-creds.js'

try {
  const data = await eenGet('/api/v3.0/cameras?pageSize=100')
  const cameras = data.results || data.cameras || data
  if (!Array.isArray(cameras)) {
    console.log(JSON.stringify(data, null, 2))
    process.exit(0)
  }

  console.log(`Found ${cameras.length} camera(s):`)
  for (const c of cameras) {
    const id = c.id || c.cameraId || '?'
    const name = c.name || '(no name)'
    const status = c.status?.connectionStatus || c.status || ''
    console.log(`  ${id}  ${name}${status ? `  [${status}]` : ''}`)
  }
} catch (err) {
  console.error(`Fatal: ${err.message}`)
  process.exit(1)
}
