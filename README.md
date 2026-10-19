# Monitorly

A live operations dashboard for tracking venue check-ins and dedicated internet
circuits. Records are stored in SQLite, and changes are pushed to open browser
pages in real time.

## Requirements

- Node.js 22.13 or newer (uses the built-in `node:sqlite` module)
- npm

## Run locally

Install dependencies:

```bash
npm install
```

For the first run, configure a bootstrap administrator account in PowerShell.
The password must be 12-128 characters:

```powershell
$env:BOOTSTRAP_ADMIN_USERNAME = "admin"
$env:BOOTSTRAP_ADMIN_PASSWORD = "replace-with-a-unique-strong-password"
npm run dev
```

The server saves a salted password hash in SQLite and only uses these variables
to create the administrator when no accounts exist. After the account is
created, future runs do not need the bootstrap variables. Do not commit
passwords or put them in source files.

Open the Vite URL shown in the terminal (usually `http://localhost:5173`). The
development command starts both the Vite frontend and the API server on port
4174. SQLite data is created in `data/monitoring.sqlite` on first run.

To access the app from another computer on the same trusted local network, run
`npm run dev` and open `http://<this-computer-ip>:5173` on that computer. Find
the host computer's IPv4 address with `ipconfig` on Windows. If Windows
Firewall prompts you, allow Node.js on private networks. The API remains
available through the frontend proxy rather than being exposed as a separate
network service. Do not expose the development server to an untrusted network
or the public internet.

## Account security

- Sign-in is required for dashboard data, record APIs, and live updates.
- Only an administrator can create or remove accounts. Users can manage
  monitoring records; administrators can also manage accounts.
- Passwords must be at least 12 characters and are stored as salted scrypt
  hashes. Sessions use random, HTTP-only, SameSite=Strict cookies and expire
  after 12 hours. Users can change their own password; changing it signs out
  their other sessions. Removing an account ends its active sessions.
- The local-network setup uses HTTP. Use it only on a trusted network; HTTP
  does not encrypt passwords or session cookies in transit. For untrusted
  networks, put the app behind HTTPS and set `COOKIE_SECURE=true`.

## Features

- Overview of pending check-ins and internet circuit health
- Separate searchable, filterable tables for venue check-ins and dedicated
  internet circuits
- Create and edit records on dedicated pages
- Full-screen presentation view with slide navigation and live updates
- SQLite persistence through a local JSON API
- Server-sent events refresh open pages after a record changes
- Responsive layout with Tailwind CSS

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the frontend and API for local development. |
| `npm run build` | Type-check and create a production frontend build. |
| `npm run lint` | Run ESLint. |
| `npm start` | Start the SQLite-backed API server. |
| `npm run preview` | Preview the built frontend alongside the SQLite API. |

Set `PORT` to change the API port or `DB_PATH` to choose another SQLite file.

## Project structure

```text
server/
└── index.js             # SQLite schema, seed data, API, and live event stream
src/
├── app/                 # Application routes and shell
├── components/          # Shared navigation and UI
├── features/
│   ├── checkins/        # Venue check-in list and editor
│   ├── dashboard/       # Operations overview
│   └── internet/        # Dedicated internet list and editor
├── hooks/               # Live data hook
├── services/            # Typed API client
├── styles/              # Tailwind entry point and global styles
├── types/               # Shared domain types
└── main.tsx             # Browser entry point
```
