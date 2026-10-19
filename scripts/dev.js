import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectPath = resolve('.')
const projectId = createHash('sha256').update(projectPath).digest('hex').slice(0, 16)
const controlAddress = process.platform === 'win32'
  ? `\\\\.\\pipe\\monitoring-dev-${projectId}`
  : join(tmpdir(), `monitoring-dev-${projectId}.sock`)
const apiPath = fileURLToPath(new URL('../server/index.js', import.meta.url))
const vitePath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const children = new Set()
let stopClient
const controlServer = createServer((socket) => {
  let command = ''
  socket.on('data', (chunk) => {
    command += chunk.toString()
    if (command.trim() === 'stop') {
      stopClient = socket
      shutdown()
    }
  })
})

let stopping = false
let finished = false
let exitCode = 0

function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  exitCode = code
  for (const child of children) child.kill('SIGTERM')
  if (children.size === 0) finishShutdown()
}

function finishShutdown() {
  if (finished) return
  finished = true
  process.exitCode = exitCode
  if (stopClient && !stopClient.destroyed) stopClient.end('stopped\n')
  controlServer.close()
}

function startChild(name, script) {
  const child = spawn(process.execPath, [script], { stdio: 'inherit' })
  children.add(child)
  child.on('error', (error) => {
    console.error(`Could not start ${name}:`, error)
    shutdown(1)
  })
  child.on('close', (code) => {
    children.delete(child)
    if (!stopping) shutdown(code ?? 1)
    if (stopping && children.size === 0) finishShutdown()
  })
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())

controlServer.on('error', (error) => {
  console.error(`Could not start dev control server: ${error.message}`)
  process.exitCode = 1
})

controlServer.listen(controlAddress, () => {
  startChild('API server', apiPath)
  startChild('Vite', vitePath)
})
