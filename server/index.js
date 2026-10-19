import { createServer } from 'node:http'
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'

const port = Number(process.env.PORT ?? 4174)
const databasePath = resolve(process.env.DB_PATH ?? 'data/monitoring.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })

const database = new DatabaseSync(databasePath)
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    event TEXT NOT NULL,
    venue TEXT NOT NULL,
    contact TEXT NOT NULL,
    check_in_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Confirmed', 'Checked in', 'At risk')),
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS internet_circuits (
    id TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    provider TEXT NOT NULL,
    circuit_id TEXT NOT NULL,
    bandwidth TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Online', 'Degraded', 'Offline')),
    last_checked TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
`)

const now = new Date()
const isoAt = (hoursFromNow) =>
  new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000).toISOString()

if (database.prepare('SELECT COUNT(*) AS total FROM checkins').get().total === 0) {
  const insert = database.prepare(`
    INSERT INTO checkins (id, event, venue, contact, check_in_at, status, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const seed = [
    ['Northstar Summit', 'Harbor Convention Center', 'Olivia Chen', 1.5, 'Pending', 'VIP arrivals expected at the east entrance.'],
    ['Design Forward 2026', 'Pier 27', 'Marcus Reed', 2.5, 'Confirmed', 'Registration desk is ready.'],
    ['Founders Week', 'The Glasshouse', 'Sofia Patel', 3.25, 'At risk', 'Waiting on updated guest list.'],
    ['Climate Tech Forum', 'Fort Mason', 'Daniel Kim', 5, 'Pending', ''],
    ['Studio Sessions', 'The Midway', 'Avery Brooks', -1, 'Checked in', ''],
  ]
  for (const [event, venue, contact, hours, status, notes] of seed) {
    insert.run(randomUUID(), event, venue, contact, isoAt(hours), status, notes, now.toISOString())
  }
}

if (database.prepare('SELECT COUNT(*) AS total FROM internet_circuits').get().total === 0) {
  const insert = database.prepare(`
    INSERT INTO internet_circuits (id, site, provider, circuit_id, bandwidth, status, last_checked, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const seed = [
    ['Harbor Convention Center', 'Lumen', 'LUM-SF-20481', '1 Gbps', 'Online', 0, 'Primary event network'],
    ['Pier 27', 'Sonic', 'SON-SF-88102', '500 Mbps', 'Degraded', -12, 'Packet loss above normal threshold'],
    ['The Glasshouse', 'Comcast Business', 'COM-GL-10933', '1 Gbps', 'Online', -2, ''],
    ['Fort Mason', 'AT&T Business', 'ATT-FM-52001', '250 Mbps', 'Offline', -28, 'Provider ticket #48219 opened'],
    ['The Midway', 'Lumen', 'LUM-SF-71048', '500 Mbps', 'Online', -5, ''],
  ]
  for (const [site, provider, circuit, bandwidth, status, hours, notes] of seed) {
    insert.run(randomUUID(), site, provider, circuit, bandwidth, status, isoAt(hours), notes, now.toISOString())
  }
}

const checkinSelect = `
  SELECT id, event, venue, contact, check_in_at AS checkInAt, status, notes, updated_at AS updatedAt
  FROM checkins ORDER BY check_in_at
`
const internetSelect = `
  SELECT id, site, provider, circuit_id AS circuitId, bandwidth, status,
    last_checked AS lastChecked, notes, updated_at AS updatedAt
  FROM internet_circuits ORDER BY site
`
const subscribers = new Map()
const sessionCookieName = 'monitorly_session'
const sessionDurationSeconds = 60 * 60 * 12
const loginAttempts = new Map()
const scryptAsync = promisify(scrypt)

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function json(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  })
  response.end(JSON.stringify(data))
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function hashPassword(password) {
  const salt = randomBytes(16)
  const derivedKey = await scryptAsync(password, salt, 64)
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`
}

async function verifyPassword(password, storedHash) {
  const [saltHex, hashHex] = storedHash.split(':')
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function usernameValue(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.')
  }
  const username = value.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new HttpError(400, 'Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.')
  }
  return username
}

function passwordValue(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
    throw new HttpError(400, 'Password must be between 12 and 128 characters.')
  }
  return value
}

function cookieValue(request, name) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  return cookie?.slice(name.length + 1) ?? null
}

function setSessionCookie(response, token) {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationSeconds}${secure}`,
  )
}

function clearSessionCookie(response) {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
  )
}

function currentSession(request) {
  const token = cookieValue(request, sessionCookieName)
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  return database.prepare(`
    SELECT sessions.id AS sessionId, sessions.expires_at AS expiresAt,
      users.id, users.username, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(hashToken(token), new Date().toISOString()) ?? null
}

function requireSameOrigin(request) {
  const origin = request.headers.origin
  const host = request.headers.host
  if (typeof origin !== 'string' || typeof host !== 'string') {
    throw new HttpError(403, 'A same-origin request is required.')
  }
  try {
    if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
      throw new HttpError(403, 'A same-origin request is required.')
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(403, 'A same-origin request is required.')
  }
}

function requireSession(request) {
  const session = currentSession(request)
  if (!session) throw new HttpError(401, 'Please sign in to continue.')
  return session
}

function requireAdmin(session) {
  if (session.role !== 'admin') throw new HttpError(403, 'Administrator access is required.')
}

function closeSessionStreams(sessionId) {
  for (const [subscriber, streamSessionId] of subscribers) {
    if (streamSessionId === sessionId) {
      subscribers.delete(subscriber)
      subscriber.end()
    }
  }
}

async function initializeAdmin() {
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString())
  const userCount = database.prepare('SELECT COUNT(*) AS total FROM users').get().total
  if (userCount > 0) return

  if (!process.env.BOOTSTRAP_ADMIN_USERNAME || !process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    throw new Error(
      'No user accounts exist. Set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD to create the initial administrator.',
    )
  }
  const username = usernameValue(process.env.BOOTSTRAP_ADMIN_USERNAME)
  const password = passwordValue(process.env.BOOTSTRAP_ADMIN_PASSWORD)
  database.prepare(`
    INSERT INTO users (id, username, password_hash, role, created_at)
    VALUES (?, ?, ?, 'admin', ?)
  `).run(randomUUID(), username, await hashPassword(password), new Date().toISOString())
  console.log(`Created initial administrator account: ${username}`)
}

async function readBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new HttpError(413, 'Request body is too large.')
  }
  try {
    return JSON.parse(body)
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.')
  }
}

function text(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 300) {
    throw new HttpError(400, `${label} is required and must be 300 characters or fewer.`)
  }
  return value.trim()
}

function optionalText(value, label) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string' || value.length > 2000) {
    throw new HttpError(400, `${label} must be 2,000 characters or fewer.`)
  }
  return value.trim()
}

function objectBody(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, 'Request body must be a JSON object.')
  }
  return value
}

function dateText(value, label) {
  const result = text(value, label)
  if (Number.isNaN(Date.parse(result))) throw new HttpError(400, `${label} must be a valid date.`)
  return result
}

function choice(value, label, options) {
  if (!options.includes(value)) throw new HttpError(400, `${label} is not a supported value.`)
  return value
}

function valuesFor(kind, input) {
  if (kind === 'check-ins') {
    return [
      text(input.event, 'Event name'),
      text(input.venue, 'Venue'),
      text(input.contact, 'Contact'),
      dateText(input.checkInAt, 'Check-in time'),
      choice(input.status, 'Status', ['Pending', 'Confirmed', 'Checked in', 'At risk']),
      optionalText(input.notes, 'Notes'),
    ]
  }
  return [
    text(input.site, 'Site'),
    text(input.provider, 'Provider'),
    text(input.circuitId, 'Circuit ID'),
    text(input.bandwidth, 'Bandwidth'),
    choice(input.status, 'Status', ['Online', 'Degraded', 'Offline']),
    dateText(input.lastChecked, 'Last checked'),
    optionalText(input.notes, 'Notes'),
  ]
}

function listFor(kind) {
  if (kind === 'check-ins') return database.prepare(checkinSelect).all()
  return database.prepare(internetSelect).all()
}

function publishChange(kind) {
  const event = `data: ${JSON.stringify({ kind, changedAt: new Date().toISOString() })}\n\n`
  for (const [subscriber] of subscribers) {
    if (subscriber.destroyed || subscriber.writableEnded) {
      subscribers.delete(subscriber)
    } else {
      subscriber.write(event)
    }
  }
}

function summary() {
  const checkins = database.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(status = 'Pending'), 0) AS pending,
      COALESCE(SUM(status = 'At risk'), 0) AS atRisk,
      COALESCE(SUM(status = 'Checked in'), 0) AS checkedIn
    FROM checkins
  `).get()
  const circuits = database.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(status = 'Online'), 0) AS online,
      COALESCE(SUM(status = 'Degraded'), 0) AS degraded,
      COALESCE(SUM(status = 'Offline'), 0) AS offline
    FROM internet_circuits
  `).get()
  return { checkins, circuits }
}

await initializeAdmin()

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  const path = url.pathname

  try {
    if (['POST', 'PUT', 'DELETE'].includes(request.method ?? '') && path.startsWith('/api/')) {
      requireSameOrigin(request)
    }

    if (request.method === 'POST' && path === '/api/auth/login') {
      const body = objectBody(await readBody(request))
      const username = usernameValue(body.username)
      const password = passwordValue(body.password)
      const nowMs = Date.now()
      const attempts = loginAttempts.get(username)
      if (attempts && attempts.resetAt > nowMs && attempts.count >= 5) {
        throw new HttpError(429, 'Too many sign-in attempts. Try again in 15 minutes.')
      }

      const user = database.prepare(`
        SELECT id, username, password_hash AS passwordHash, role
        FROM users WHERE username = ?
      `).get(username)
      const verified = await verifyPassword(
        password,
        user?.passwordHash ?? `${'00'.repeat(16)}:${'00'.repeat(64)}`,
      )
      if (!user || !verified) {
        const current = attempts && attempts.resetAt > nowMs
          ? attempts
          : { count: 0, resetAt: nowMs + 15 * 60 * 1000 }
        current.count += 1
        loginAttempts.set(username, current)
        throw new HttpError(401, 'Invalid username or password.')
      }

      loginAttempts.delete(username)
      const token = randomBytes(32).toString('hex')
      const sessionId = randomUUID()
      const expiresAt = new Date(nowMs + sessionDurationSeconds * 1000).toISOString()
      database.prepare(`
        INSERT INTO sessions (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, ?)
      `).run(sessionId, hashToken(token), user.id, expiresAt)
      setSessionCookie(response, token)
      json(response, 200, { id: user.id, username: user.username, role: user.role })
      return
    }

    if (request.method === 'GET' && path === '/api/auth/me') {
      const session = currentSession(request)
      json(response, 200, { user: session
        ? { id: session.id, username: session.username, role: session.role }
        : null })
      return
    }

    if (request.method === 'POST' && path === '/api/auth/logout') {
      const session = requireSession(request)
      database.prepare('DELETE FROM sessions WHERE id = ?').run(session.sessionId)
      closeSessionStreams(session.sessionId)
      clearSessionCookie(response)
      json(response, 200, { ok: true })
      return
    }

    const session = requireSession(request)

    if (request.method === 'POST' && path === '/api/auth/password') {
      const body = objectBody(await readBody(request))
      const currentPassword = passwordValue(body.currentPassword)
      const newPassword = passwordValue(body.newPassword)
      const stored = database.prepare('SELECT password_hash AS passwordHash FROM users WHERE id = ?')
        .get(session.id)
      if (!await verifyPassword(currentPassword, stored.passwordHash)) {
        throw new HttpError(401, 'Current password is incorrect.')
      }

      const newHash = await hashPassword(newPassword)
      const token = randomBytes(32).toString('hex')
      const newSessionId = randomUUID()
      const expiresAt = new Date(Date.now() + sessionDurationSeconds * 1000).toISOString()
      const activeSessionIds = database.prepare('SELECT id FROM sessions WHERE user_id = ?')
        .all(session.id)
      database.exec('BEGIN IMMEDIATE')
      try {
        database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, session.id)
        database.prepare('DELETE FROM sessions WHERE user_id = ?').run(session.id)
        database.prepare(`
          INSERT INTO sessions (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, ?)
        `).run(newSessionId, hashToken(token), session.id, expiresAt)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
      for (const activeSessionId of activeSessionIds) closeSessionStreams(activeSessionId.id)
      setSessionCookie(response, token)
      json(response, 200, { ok: true })
      return
    }

    if (path === '/api/users') {
      requireAdmin(session)
      if (request.method === 'GET') {
        const users = database.prepare(`
          SELECT id, username, role, created_at AS createdAt FROM users ORDER BY username
        `).all()
        json(response, 200, users)
        return
      }
      if (request.method === 'POST') {
        const body = objectBody(await readBody(request))
        const username = usernameValue(body.username)
        const password = passwordValue(body.password)
        const role = choice(body.role ?? 'user', 'Role', ['admin', 'user'])
        if (database.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
          throw new HttpError(409, 'That username is already in use.')
        }
        const user = {
          id: randomUUID(),
          username,
          role,
          createdAt: new Date().toISOString(),
        }
        database.prepare(`
          INSERT INTO users (id, username, password_hash, role, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(user.id, username, await hashPassword(password), role, user.createdAt)
        json(response, 201, user)
        return
      }
    }

    const deleteUserMatch = path.match(/^\/api\/users\/([0-9a-f-]+)$/i)
    if (request.method === 'DELETE' && deleteUserMatch) {
      requireAdmin(session)
      const targetId = deleteUserMatch[1]
      const target = database.prepare('SELECT id, role FROM users WHERE id = ?').get(targetId)
      if (!target) throw new HttpError(404, 'User not found.')
      if (targetId === session.id) throw new HttpError(400, 'You cannot remove your own account.')
      if (target.role === 'admin' &&
          database.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'").get().total <= 1) {
        throw new HttpError(400, 'The last administrator account cannot be removed.')
      }
      database.prepare('DELETE FROM users WHERE id = ?').run(targetId)
      return json(response, 200, { id: targetId })
    }

    if (request.method === 'GET' && path === '/api/events') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      })
      response.write(': connected\n\n')
      subscribers.set(response, session.sessionId)
      response.on('close', () => subscribers.delete(response))
      response.on('error', (error) => {
        subscribers.delete(response)
        console.error('SSE stream failed:', error)
      })
      return
    }

    if (request.method === 'GET' && path === '/api/summary') {
      json(response, 200, summary())
      return
    }

    const match = path.match(/^\/api\/([^/]+)(?:\/([^/]+))?\/?$/i)
    if (!match) throw new HttpError(404, 'API endpoint not found.')

    const resourceName = match[1].toLowerCase().replace(/[-_]/g, '')
    const kind =
      resourceName === 'checkins' ? 'check-ins' :
      resourceName === 'internet' || resourceName === 'internetcircuits' ? 'internet' :
      null
    if (!kind) throw new HttpError(404, 'API endpoint not found.')

    const table = kind === 'check-ins' ? 'checkins' : 'internet_circuits'
    const id = match[2] || null

    if (request.method === 'GET' && !id) {
      json(response, 200, listFor(kind))
      return
    }

    if (request.method === 'GET' && id) {
      const item = listFor(kind).find((record) => record.id === id)
      if (!item) throw new HttpError(404, 'Record not found.')
      json(response, 200, item)
      return
    }

    if (request.method === 'POST' && !id) {
      const body = objectBody(await readBody(request))
      const values = valuesFor(kind, body)
      const recordId = randomUUID()
      const updatedAt = new Date().toISOString()
      const columns = kind === 'check-ins'
        ? 'id, event, venue, contact, check_in_at, status, notes, updated_at'
        : 'id, site, provider, circuit_id, bandwidth, status, last_checked, notes, updated_at'
      const placeholders = values.map(() => '?').join(', ')
      database.prepare(`INSERT INTO ${table} (${columns}) VALUES (?, ${placeholders}, ?)`)
        .run(recordId, ...values, updatedAt)
      publishChange(kind)
      json(response, 201, listFor(kind).find((record) => record.id === recordId))
      return
    }

    if (request.method === 'PUT' && id) {
      const body = objectBody(await readBody(request))
      const values = valuesFor(kind, body)
      const updatedAt = new Date().toISOString()
      const assignments = kind === 'check-ins'
        ? 'event = ?, venue = ?, contact = ?, check_in_at = ?, status = ?, notes = ?, updated_at = ?'
        : 'site = ?, provider = ?, circuit_id = ?, bandwidth = ?, status = ?, last_checked = ?, notes = ?, updated_at = ?'
      const result = database.prepare(`UPDATE ${table} SET ${assignments} WHERE id = ?`)
        .run(...values, updatedAt, id)
      if (result.changes === 0) throw new HttpError(404, 'Record not found.')
      publishChange(kind)
      json(response, 200, listFor(kind).find((record) => record.id === id))
      return
    }

    if (request.method === 'DELETE' && id) {
      const result = database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id)
      if (result.changes === 0) throw new HttpError(404, 'Record not found.')
      publishChange(kind)
      json(response, 200, { id })
      return
    }

    throw new HttpError(405, 'Method not allowed.')
  } catch (error) {
    if (error instanceof HttpError) {
      json(response, error.status, { error: error.message })
      return
    }
    console.error('API request failed:', error)
    json(response, 500, { error: 'The request could not be completed.' })
  }
})

const heartbeat = setInterval(() => {
  const now = new Date().toISOString()
  for (const [subscriber, sessionId] of subscribers) {
    const active = database.prepare('SELECT 1 FROM sessions WHERE id = ? AND expires_at > ?')
      .get(sessionId, now)
    if (!active) {
      subscribers.delete(subscriber)
      subscriber.end()
    } else {
      subscriber.write(': heartbeat\n\n')
    }
  }
}, 25_000)
heartbeat.unref()

server.listen(port, '127.0.0.1', () => {
  console.log(`Monitoring API listening on http://localhost:${port}`)
  console.log(`SQLite database: ${databasePath}`)
})
