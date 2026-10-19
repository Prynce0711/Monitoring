import { createHash } from 'node:crypto'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const projectId = createHash('sha256').update(resolve('.')).digest('hex').slice(0, 16)
const controlAddress = process.platform === 'win32'
  ? `\\\\.\\pipe\\monitoring-dev-${projectId}`
  : join(tmpdir(), `monitoring-dev-${projectId}.sock`)
const connection = createConnection(controlAddress)
let connected = false

connection.once('connect', () => {
  connected = true
  connection.write('stop\n')
})

connection.on('data', (data) => {
  if (data.toString().trim() === 'stopped') {
    console.log('Stopped the development frontend and API.')
    connection.end()
  }
})

connection.once('error', (error) => {
  if (!connected && (error.code === 'ENOENT' || error.code === 'ECONNREFUSED')) {
    console.error('The development frontend and API are not running.')
  } else if (connected) {
    console.error(`Could not confirm dev shutdown: ${error.message}`)
  } else {
    console.error(`Could not stop the development frontend and API: ${error.message}`)
  }
  process.exitCode = 1
})
