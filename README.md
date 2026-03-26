# Personal Financial Assistance

A full-stack personal finance web application for tracking a user's financial profile across seven areas:

1. Income
2. Assets
3. Liabilities
4. Protection
5. Estate
6. Intangibles
7. Authentication (sign up/login/logout)

## Current Architecture

The app currently runs on a custom Node.js HTTP server.

- Runtime: Node.js (CommonJS)
- Server: native `http` module in [app.js](app.js)
- Database: SQLite via `better-sqlite3`
- Auth: cookie-based server-side sessions (in-memory `Map`)
- Frontend: static HTML/CSS/JS pages under [templates](templates)
- Charts: Chart.js loaded from jsDelivr CDN

## Implemented Features

### Auth

- Sign up: `POST /api/signup`
- Login: `POST /api/login`
- Logout: `GET /api/logout`
- Current user: `GET /api/me`

Auth pages are served from [templates/Auth](templates/Auth).

### Financial Modules

The following user-scoped modules are implemented with CRUD APIs:

- Income: `/api/income`
- Assets: `/api/assets`
- Liabilities: `/api/liabilities`
- Protection: `/api/protection`
- Estate: `/api/estate`
- Intangibles: `/api/intangibles`

Each module supports:

- `GET /api/<table>` list entries
- `POST /api/<table>` create entry
- `POST /api/<table>/<id>/edit` update entry
- `POST /api/<table>/<id>/delete` delete entry

### Dashboard

- Aggregates are exposed via `GET /api/dashboard`.
- Dashboard page is in [templates/Dashboard](templates/Dashboard).

### Exchange Rates

- Endpoint: `GET /api/exchange-rates` (authenticated)
- Server behavior: attempts live rates from `open.er-api.com`, caches successful live responses for 1 hour, falls back to internal static rates if live fetch fails, and caches fallback for 10 minutes.

## Security Notes

Responses include security headers from [app.js](app.js):

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- CSP restricting resource origins (`self` + approved CDNs)

Input handling includes:

- Request body size limits
- Basic sanitization for text fields
- Date validation for relevant fields
- Currency whitelist checks

## Data Model

Database schema is defined in [database/schema.sql](database/schema.sql).

Tables:

- `users`
- `income`
- `assets`
- `liabilities`
- `protection`
- `estate`
- `intangibles`

All finance tables include `user_id` for per-user isolation.

## Project Structure

```text
Uni-Web-Application-Personal-Financial-Assistance-/
├── app.js
├── database.js
├── package.json
├── README.md
├── database/
│   ├── schema.sql
│   └── seed.sql
├── data/
│   └── finance.db (created at runtime)
├── routes/
│   └── auth.js (legacy Express-style route file, not wired into current server)
└── templates/
    ├── Welcome_Page/
    ├── Auth/
    ├── Dashboard/
    ├── Income/
    ├── Assets/
    ├── Liabilities/
    ├── Protection/
    ├── Estate/
    └── Intangibles/
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

or:

```bash
node app.js
```

3. Open:

```text
http://localhost:3000
```

The server automatically retries higher ports if `3000` is busy (up to 10 retries).

## API Summary

- `GET /api/me`
- `POST /api/signup`
- `POST /api/login`
- `GET /api/logout`
- `POST /api/preferences`
- `GET /api/exchange-rates`
- `GET /api/dashboard`
- CRUD endpoints for each finance table under `/api/<table>`

## Authors

- Hamza (P2840014)
- Shivam (P2839138)
- Rudra (P2896774)