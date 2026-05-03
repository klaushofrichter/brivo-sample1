#!/usr/bin/env node
// Usage: node camera-settings.js <cameraId>
import { eenGet } from './lib-creds.js'

const INCLUDE = [
  'bridge',
  'account',
  'status',
  'statusV2',
  'locationSummary',
  'deviceAddress',
  'timeZone',
  'notes',
  'tags',
  'devicePosition',
  'networkInfo',
  'deviceInfo',
  'effectivePermissions',
  'firmware',
  'shareDetails',
  'visibleByBridges',
  'capabilities',
  'analog',
  'packages',
  'dewarpConfig',
  'publicSafetySharing',
  'enabledAnalytics'
].join(',')

const cameraId = process.argv[2]
if (!cameraId) {
  console.error('Usage: node camera-settings.js <cameraId>')
  process.exit(2)
}

try {
  const camera = await eenGet(`/api/v3.0/cameras/${encodeURIComponent(cameraId)}?include=${INCLUDE}`)
  console.log(JSON.stringify(camera, null, 2))
} catch (err) {
  console.error(`Fatal: ${err.message}`)
  process.exit(1)
}
