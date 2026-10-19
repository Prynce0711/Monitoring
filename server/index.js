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
  CREATE TABLE IF NOT EXISTS presentation_projects (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Ongoing', 'Done'))
  );
  CREATE TABLE IF NOT EXISTS internet_requests (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Ongoing', 'Done')),
    event_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    bandwidth TEXT NOT NULL,
    ssid_name TEXT NOT NULL DEFAULT '',
    password_name TEXT NOT NULL DEFAULT '',
    function_room TEXT NOT NULL,
    events_organizer TEXT NOT NULL,
    remarks TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS venue_setup_requests (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Ongoing', 'Done')),
    event_description TEXT NOT NULL,
    start_date TEXT NOT NULL,
    beo_number TEXT NOT NULL,
    no_of_computers TEXT NOT NULL,
    function_room TEXT NOT NULL,
    events_organizer TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS team_endorsements (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    endorse_date TEXT NOT NULL,
    notes TEXT NOT NULL,
    assign_to TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Ongoing', 'Done'))
  );
  CREATE TABLE IF NOT EXISTS presentation_uploads (
    kind TEXT PRIMARY KEY CHECK (kind IN ('service-desk', 'shift')),
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    image_data BLOB NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

const internetRequestColumns = new Set(
  database.prepare('PRAGMA table_info(internet_requests)').all().map((column) => column.name),
)
if (!internetRequestColumns.has('ssid_name')) {
  database.exec("ALTER TABLE internet_requests ADD COLUMN ssid_name TEXT NOT NULL DEFAULT ''")
}
if (!internetRequestColumns.has('password_name')) {
  database.exec("ALTER TABLE internet_requests ADD COLUMN password_name TEXT NOT NULL DEFAULT ''")
}

if (database.prepare('SELECT COUNT(*) AS total FROM presentation_projects').get().total === 0) {
  const initialProjects = [
    ['Refresh Core Network Switch - Nov 9, Delivery', 'Pending'],
    ['Refresh Firewall FortiGate - Nov 9, Delivery', 'Pending'],
    ['Shiji Kunlun eSignature Cloud', 'Ongoing'],
    ['Configure 3 laptops for check-in venue', 'Pending'],
    ['6 TV signage displays, 24 inches - Rizal', 'Pending'],
    ['ASEAN Summit - Preparation Network/Wireless/Linkbroad IPTV/UPS', 'Pending'],
    ['APIPA - House of Representative - DIA 100Mbps', 'Pending'],
    ['QCR PCI Audit - October 26-27', 'Pending'],
    ['VMware migration to Sangfor', 'Pending'],
    ['Veeam Vault Cloud Backup Replication Solution', 'Pending'],
    ['Fixed Asset Equipment Disposal - Network Devices, Cables, Computers and Monitors', 'Pending'],
    ['Bake House - Opening Preparations', 'Pending'],
    ['Additional ISP - 400 Mbps', 'Pending'],
    ['Infrastructure Network Alignment ISP, BGP, Core, HSIA', 'Pending'],
    ['HSIA Gateway Upgrade', 'Pending'],
    ['Finance Digitalization - RFP, COC etc', 'Pending'],
    ['HR Digitalization - COE etc', 'Pending'],
    ['CSR and SSL Certificate Installation: Opera and SCM', 'Pending'],
    ['Fridge Monitoring Equipment - Cabling Works & Access Points', 'Pending'],
    ['KPC Replacement - Circles Events Cafe', 'Pending'],
    ['Thermal Printer: Shang Palace', 'Pending'],
    ['ServiceDesk / System Access / Tickets', 'Pending'],
    ['SBSSI - HQ Set-up 5 Computers to B3 - HR Training Room 26-30 October', 'Pending'],
    ['65 Inches IPTV Floors 11-14 Installation', 'Pending'],
    ['Wireless Project: AP 1427', 'Ongoing'],
    ['Vingcard Lockset Upgrade', 'Pending'],
    ['Transition from the Converge Kabelnet box to Cignal', 'Pending'],
    ['LBTechnology Contract for IPTV - December 31', 'Pending'],
  ]
  const insertProject = database.prepare(`
    INSERT INTO presentation_projects (id, sort_order, title, status) VALUES (?, ?, ?, ?)
  `)
  for (const [index, [title, status]] of initialProjects.entries()) {
    insertProject.run(randomUUID(), index + 1, title, status)
  }
}

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

async function readBody(request, maxLength = 1_000_000) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > maxLength) throw new HttpError(413, 'Request body is too large.')
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

function tableText(value, label) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string' || value.length > 300) {
    throw new HttpError(400, `${label} must be 300 characters or fewer.`)
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

function tableDate(value, label) {
  const result = tableText(value, label)
  if (result && Number.isNaN(Date.parse(result))) throw new HttpError(400, `${label} must be a valid date.`)
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

function presentationContent() {
  const projects = database.prepare(`
    SELECT id, sort_order AS sortOrder, title, status
    FROM presentation_projects ORDER BY sort_order, id
  `).all()
  const internetRequests = database.prepare(`
    SELECT id, sort_order AS sortOrder, status, event_name AS eventName,
      start_date AS startDate, start_time AS startTime, bandwidth,
      ssid_name AS ssidName, password_name AS passwordName,
      function_room AS functionRoom, events_organizer AS eventsOrganizer, remarks
    FROM internet_requests ORDER BY sort_order, id
  `).all()
  const venueSetupRequests = database.prepare(`
    SELECT id, sort_order AS sortOrder, status, event_description AS eventDescription,
      start_date AS startDate, beo_number AS beoNumber,
      no_of_computers AS noOfComputers, function_room AS functionRoom,
      events_organizer AS eventsOrganizer
    FROM venue_setup_requests ORDER BY sort_order, id
  `).all()
  const teamEndorsements = database.prepare(`
    SELECT id, sort_order AS sortOrder, endorse_date AS endorseDate,
      notes, assign_to AS assignTo, status
    FROM team_endorsements ORDER BY sort_order, id
  `).all()
  const uploads = database.prepare(`
    SELECT kind, file_name AS fileName, mime_type AS mimeType,
      updated_at AS updatedAt, length(image_data) AS size
    FROM presentation_uploads ORDER BY kind
  `).all().map((upload) => ({
    ...upload,
    imageUrl: `/api/presentation/uploads/${upload.kind}/image?v=${encodeURIComponent(upload.updatedAt)}`,
  }))
  return { projects, internetRequests, venueSetupRequests, teamEndorsements, uploads }
}

function inputRows(value, label, maximum) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new HttpError(400, `${label} must be a list of no more than ${maximum} entries.`)
  }
  const ids = new Set()
  return value.map((item, index) => {
    objectBody(item)
    const id = item.id
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || ids.has(id)) {
      throw new HttpError(400, `${label} entry ${index + 1} has an invalid or duplicate ID.`)
    }
    ids.add(id)
    return { id, sortOrder: index + 1, item }
  })
}

function statusFor(value) {
  return choice(value, 'Status', ['Pending', 'Ongoing', 'Done'])
}

function savePresentationContent(body) {
  const projects = inputRows(body.projects, 'Projects', 500).map(({ id, sortOrder, item }) => ({
    id,
    sortOrder,
    title: tableText(item.title, 'Project title'),
    status: statusFor(item.status),
  }))
  const internetRequests = inputRows(body.internetRequests, 'Internet requests', 500).map(({ id, sortOrder, item }) => ({
    id,
    sortOrder,
    status: statusFor(item.status),
    eventName: tableText(item.eventName, 'Event name'),
    startDate: tableDate(item.startDate, 'Start date'),
    startTime: tableText(item.startTime, 'Start time'),
    bandwidth: tableText(item.bandwidth, 'Bandwidth'),
    ssidName: tableText(item.ssidName, 'SSID name'),
    passwordName: tableText(item.passwordName, 'Password name'),
    functionRoom: tableText(item.functionRoom, 'Function room'),
    eventsOrganizer: tableText(item.eventsOrganizer, 'Events organizer'),
    remarks: optionalText(item.remarks, 'Remarks'),
  }))
  const venueSetupRequests = inputRows(body.venueSetupRequests, 'Venue setup requests', 500).map(({ id, sortOrder, item }) => ({
    id,
    sortOrder,
    status: statusFor(item.status),
    eventDescription: tableText(item.eventDescription, 'Event description'),
    startDate: tableDate(item.startDate, 'Start date'),
    beoNumber: tableText(item.beoNumber, 'BEO number'),
    noOfComputers: tableText(item.noOfComputers, 'Number of computers'),
    functionRoom: tableText(item.functionRoom, 'Function room'),
    eventsOrganizer: tableText(item.eventsOrganizer, 'Events organizer'),
  }))
  const teamEndorsements = inputRows(body.teamEndorsements, 'Team endorsements', 500).map(({ id, sortOrder, item }) => ({
    id,
    sortOrder,
    endorseDate: tableDate(item.endorseDate, 'Endorse date'),
    notes: optionalText(item.notes, 'Endorsement notes'),
    assignTo: tableText(item.assignTo, 'Assigned team member'),
    status: statusFor(item.status),
  }))

  database.exec('BEGIN IMMEDIATE')
  try {
    database.exec('DELETE FROM presentation_projects; DELETE FROM internet_requests; DELETE FROM venue_setup_requests; DELETE FROM team_endorsements;')
    const insertProject = database.prepare(`
      INSERT INTO presentation_projects (id, sort_order, title, status) VALUES (?, ?, ?, ?)
    `)
    for (const project of projects) {
      insertProject.run(project.id, project.sortOrder, project.title, project.status)
    }
    const insertInternet = database.prepare(`
      INSERT INTO internet_requests
        (id, sort_order, status, event_name, start_date, start_time, bandwidth, ssid_name, password_name, function_room, events_organizer, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const request of internetRequests) {
      insertInternet.run(
        request.id, request.sortOrder, request.status, request.eventName, request.startDate,
        request.startTime, request.bandwidth, request.ssidName, request.passwordName,
        request.functionRoom, request.eventsOrganizer, request.remarks,
      )
    }
    const insertVenue = database.prepare(`
      INSERT INTO venue_setup_requests
        (id, sort_order, status, event_description, start_date, beo_number, no_of_computers, function_room, events_organizer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const request of venueSetupRequests) {
      insertVenue.run(
        request.id, request.sortOrder, request.status, request.eventDescription, request.startDate,
        request.beoNumber, request.noOfComputers, request.functionRoom, request.eventsOrganizer,
      )
    }
    const insertEndorsement = database.prepare(`
      INSERT INTO team_endorsements (id, sort_order, endorse_date, notes, assign_to, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const endorsement of teamEndorsements) {
      insertEndorsement.run(
        endorsement.id, endorsement.sortOrder, endorsement.endorseDate,
        endorsement.notes, endorsement.assignTo, endorsement.status,
      )
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

function verifiedImage(value) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new HttpError(400, 'Image data must be valid base64.')
  }
  const image = Buffer.from(value, 'base64')
  if (image.length === 0 || image.length > 8 * 1024 * 1024) {
    throw new HttpError(413, 'Image must be no larger than 8 MB.')
  }
  const isPng = image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isJpeg = image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
  const isWebp = image.length >= 12 && image.toString('ascii', 0, 4) === 'RIFF' &&
    image.toString('ascii', 8, 12) === 'WEBP'
  if (!isPng && !isJpeg && !isWebp) {
    throw new HttpError(400, 'Only PNG, JPEG, or WebP images are supported.')
  }
  return { image, mimeType: isPng ? 'image/png' : isJpeg ? 'image/jpeg' : 'image/webp' }
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

    if (request.method === 'GET' && path === '/api/presentation/content') {
      json(response, 200, presentationContent())
      return
    }

    const imageMatch = path.match(/^\/api\/presentation\/uploads\/(service-desk|shift)\/image$/)
    if (request.method === 'GET' && imageMatch) {
      const upload = database.prepare(`
        SELECT mime_type AS mimeType, image_data AS imageData
        FROM presentation_uploads WHERE kind = ?
      `).get(imageMatch[1])
      if (!upload) throw new HttpError(404, 'No screenshot has been uploaded for this slide.')
      response.writeHead(200, {
        'Content-Type': upload.mimeType,
        'Content-Length': upload.imageData.length,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      })
      response.end(upload.imageData)
      return
    }

    if (request.method === 'PUT' && path === '/api/admin/presentation/content') {
      requireAdmin(session)
      savePresentationContent(objectBody(await readBody(request)))
      publishChange('presentation')
      json(response, 200, presentationContent())
      return
    }

    const uploadMatch = path.match(/^\/api\/admin\/presentation\/uploads\/(service-desk|shift)$/)
    if (uploadMatch && request.method === 'POST') {
      requireAdmin(session)
      const body = objectBody(await readBody(request, 12_000_000))
      const fileName = text(body.fileName, 'File name')
      const { image, mimeType } = verifiedImage(body.data)
      database.prepare(`
        INSERT INTO presentation_uploads (kind, file_name, mime_type, image_data, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(kind) DO UPDATE SET
          file_name = excluded.file_name,
          mime_type = excluded.mime_type,
          image_data = excluded.image_data,
          updated_at = excluded.updated_at
      `).run(uploadMatch[1], fileName, mimeType, image, new Date().toISOString())
      publishChange('presentation')
      json(response, 201, presentationContent())
      return
    }

    if (uploadMatch && request.method === 'DELETE') {
      requireAdmin(session)
      const result = database.prepare('DELETE FROM presentation_uploads WHERE kind = ?').run(uploadMatch[1])
      if (result.changes === 0) throw new HttpError(404, 'No screenshot has been uploaded for this slide.')
      publishChange('presentation')
      json(response, 200, presentationContent())
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
