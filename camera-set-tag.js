#!/usr/bin/env node
// Usage: node camera-set-tag.js <cameraId> <tag>
import { eenGet, eenPatch } from './lib-creds.js'

const [cameraId, tag] = process.argv.slice(2)
if (!cameraId || !tag) {
  console.error('Usage: node camera-set-tag.js <cameraId> <tag>')
  process.exit(2)
}

try {
  const data = await eenGet(`/api/v3.0/cameras/${encodeURIComponent(cameraId)}?include=tags`)
  const current = Array.isArray(data.tags) ? data.tags : []

  if (current.includes(tag)) {
    console.log(`Tag "${tag}" already present on ${cameraId}. Tags: ${JSON.stringify(current)}`)
    process.exit(0)
  }

  const next = [...current, tag]
  await eenPatch(`/api/v3.0/cameras/${encodeURIComponent(cameraId)}`, { tags: next })
  console.log(`Added tag "${tag}" to ${cameraId}. Tags: ${JSON.stringify(next)}`)
} catch (err) {
  console.error(`Fatal: ${err.message}`)
  process.exit(1)
}
