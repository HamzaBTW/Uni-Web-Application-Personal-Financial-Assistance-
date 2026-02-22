# Personal Financial Assistance — Planning Document Guide

A step-by-step guide for producing the full planning deliverable using **Node.js + Express + SQLite**.

---

## Step 1: Team Introduction

Write a brief paragraph introducing your team, the application, and its purpose.

> **Team:** Hamza, Shivam, Rudra (DMU Module 7)
>
> **Application:** *Personal Financial Assistance* — a web app that gives users a complete picture of their financial health.
>
> **Target users:** Young professionals and students who want to track income, assets, debts, insurance, estate plans, and intangible wealth in one place.
>
> **What users can do:** Register an account, log in, and manage data across 6 financial categories. The dashboard shows a unified snapshot including net worth, income summary, and protection status.
>
> **Why:** Most people only track spending. This app covers the *full* financial picture — what you earn, own, owe, protect, plan for, and your non-monetary advantages.

---

## Step 2: Database Diagram (ER Diagram)

Draw a diagram with **7 tables** linked by `user_id` foreign keys. You can use:

- **draw.io** (free, exports to PNG) — [app.diagrams.net](https://app.diagrams.net)
- **dbdiagram.io** — paste DBML code and it generates the diagram
- **Mermaid** — if your report is in Markdown

### Schema Overview

```
users
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── email       TEXT UNIQUE NOT NULL
├── username    TEXT NOT NULL
├── password_hash TEXT NOT NULL
└── created_at  TEXT DEFAULT CURRENT_TIMESTAMP

income (FK: user_id → users.id)
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── user_id     INTEGER NOT NULL
├── source_type TEXT        -- 'employment', 'freelance', 'investment', 'rental'
├── description TEXT
├── amount      REAL NOT NULL
├── frequency   TEXT        -- 'weekly', 'monthly', 'annual'
└── tax_band    TEXT

assets (FK: user_id → users.id)
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── user_id     INTEGER NOT NULL
├── category    TEXT        -- 'cash', 'investments', 'property', 'vehicles', 'valuables'
├── description TEXT
└── value       REAL NOT NULL

liabilities (FK: user_id → users.id)
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── user_id     INTEGER NOT NULL
├── category    TEXT        -- 'mortgage', 'student_loan', 'credit_card', 'personal_loan', 'overdraft'
├── description TEXT
├── balance     REAL NOT NULL
└── interest_rate REAL

protection (FK: user_id → users.id)
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── user_id     INTEGER NOT NULL
├── policy_type TEXT        -- 'life', 'health', 'home', 'vehicle', 'income_protection'
├── provider    TEXT
├── premium     REAL
├── start_date  TEXT
└── renewal_date TEXT

estate (FK: user_id → users.id)
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── user_id     INTEGER NOT NULL
├── item_type   TEXT        -- 'will', 'power_of_attorney', 'trust', 'beneficiary'
├── status      TEXT        -- 'complete', 'incomplete', 'in_progress'
├── details     TEXT
└── contact_info TEXT

intangibles (FK: user_id → users.id)
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── user_id     INTEGER NOT NULL
├── category    TEXT        -- 'skills', 'network', 'ip', 'brand', 'financial_literacy', 'health'
├── score       INTEGER     -- 1-10
└── description TEXT
```

### DBML (paste into dbdiagram.io)

```dbml
Table users {
  id integer [pk, increment]
  email text [unique, not null]
  username text [not null]
  password_hash text [not null]
  created_at text
}

Table income {
  id integer [pk, increment]
  user_id integer [ref: > users.id]
  source_type text
  description text
  amount real [not null]
  frequency text
  tax_band text
}

Table assets {
  id integer [pk, increment]
  user_id integer [ref: > users.id]
  category text
  description text
  value real [not null]
}

Table liabilities {
  id integer [pk, increment]
  user_id integer [ref: > users.id]
  category text
  description text
  balance real [not null]
  interest_rate real
}

Table protection {
  id integer [pk, increment]
  user_id integer [ref: > users.id]
  policy_type text
  provider text
  premium real
  start_date text
  renewal_date text
}

Table estate {
  id integer [pk, increment]
  user_id integer [ref: > users.id]
  item_type text
  status text
  details text
  contact_info text
}

Table intangibles {
  id integer [pk, increment]
  user_id integer [ref: > users.id]
  category text
  score integer
  description text
}
```

### How to generate the diagram

1. Go to [dbdiagram.io](https://dbdiagram.io)
2. Paste the DBML code above
3. Screenshot the result → put it in your report

---

## Step 3: UI Concept Sketches / HTML+CSS Prototypes

Build **3–4 static HTML pages** with CSS styling — no JS logic needed, just visual mockups.

### Pages to prototype

1. **Login / Sign Up page** — forms with email, username, password fields
2. **Dashboard** — cards showing net worth, income total, asset total, liabilities total
3. **One CRUD page** (e.g. Assets) — a form to add entries + a table listing existing ones
4. **Nav bar** — shared across all pages

### How to do it

1. Create a `prototypes/` folder
2. Build each as a standalone `.html` file with inline or linked CSS
3. Focus on **layout and visual design**, not functionality
4. Screenshot them for your report, or submit the HTML files directly

---

## Step 4: Route Map (Technical Map)

Create a table listing every URL, its purpose, HTTP method, and what data it handles.

### Authentication Routes

| Method | URL | Purpose | Links / Forms |
|--------|-----|---------|---------------|
| GET | `/login` | Login page | Form: email, password → POST `/login` |
| POST | `/login` | Authenticate user | Redirects to `/` on success |
| GET | `/signup` | Registration page | Form: email, username, password, confirm → POST `/signup` |
| POST | `/signup` | Create account | Redirects to `/login` on success |
| GET | `/logout` | End session | Redirects to `/login` |

### Dashboard

| Method | URL | Purpose | Links / Forms |
|--------|-----|---------|---------------|
| GET | `/` | Dashboard (financial summary) | Links to all 6 sub-pages, logout |

### Income & Tax

| Method | URL | Purpose | Links / Forms |
|--------|-----|---------|---------------|
| GET | `/income` | View income entries | Link to add form, edit/delete buttons per row |
| POST | `/income` | Add new income entry | Form: source_type, description, amount, frequency |
| POST | `/income/:id/edit` | Update income entry | Same form, pre-filled |
| POST | `/income/:id/delete` | Remove income entry | Delete button |

### Assets

| Method | URL | Purpose | Links / Forms |
|--------|-----|---------|---------------|
| GET | `/assets` | View assets | Link to add form, edit/delete buttons per row |
| POST | `/assets` | Add asset | Form: category, description, value |
| POST | `/assets/:id/edit` | Update asset | Same form, pre-filled |
| POST | `/assets/:id/delete` | Delete asset | Delete button |

### Liabilities

| Method | URL | Purpose | Links / Forms |
|--------|-----|---------|---------------|
| GET | `/liabilities` | View liabilities | Link to add form, edit/delete buttons per row |
| POST | `/liabilities` | Add liability | Form: category, description, balance, interest_rate |
| POST | `/liabilities/:id/edit` | Update liability | Same form, pre-filled |
| POST | `/liabilities/:id/delete` | Delete liability | Delete button |

### Protection

| Method | URL | Purpose | Links / Forms |
|--------|-----|---------|---------------|
| GET | `/protection` | View insurance policies | Link to add form, edit/delete buttons per row |
| POST | `/protection` | Add policy | Form: policy_type, provider, premium, start_date, renewal_date |
| POST | `/protection/:id/edit` | Update policy | Same form, pre-filled |
| POST | `/protection/:id/delete` | Delete policy | Delete button |

### Estate

| Method | URL | Purpose | Links / Forms |
|--------|-----|---------|---------------|
| GET | `/estate` | View estate items | Link to add form, edit/delete buttons per row |
| POST | `/estate` | Add estate item | Form: item_type, status, details, contact_info |
| POST | `/estate/:id/edit` | Update estate item | Same form, pre-filled |
| POST | `/estate/:id/delete` | Delete estate item | Delete button |

### Intangibles

| Method | URL | Purpose | Links / Forms |
|--------|-----|---------|---------------|
| GET | `/intangibles` | View intangibles | Link to add form, edit/delete buttons per row |
| POST | `/intangibles` | Add intangible | Form: category, score, description |
| POST | `/intangibles/:id/edit` | Update intangible | Same form, pre-filled |
| POST | `/intangibles/:id/delete` | Delete intangible | Delete button |

---

## Step 5: SQL Queries

### CREATE Tables (run once on setup)

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source_type TEXT,
    description TEXT,
    amount REAL NOT NULL,
    frequency TEXT,
    tax_band TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT,
    description TEXT,
    value REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS liabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT,
    description TEXT,
    balance REAL NOT NULL,
    interest_rate REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS protection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    policy_type TEXT,
    provider TEXT,
    premium REAL,
    start_date TEXT,
    renewal_date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS estate (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_type TEXT,
    status TEXT,
    details TEXT,
    contact_info TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS intangibles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT,
    score INTEGER,
    description TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Auth Queries

```sql
-- Sign up (create new user)
INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?);

-- Login (fetch hash to compare)
SELECT id, username, password_hash FROM users WHERE email = ?;

-- Check for duplicate email before registration
SELECT COUNT(*) FROM users WHERE email = ?;
```

### CRUD Queries (example: assets — same pattern for all 6 tables)

```sql
-- List all assets for a user
SELECT * FROM assets WHERE user_id = ? ORDER BY id DESC;

-- Add a new asset
INSERT INTO assets (user_id, category, description, value) VALUES (?, ?, ?, ?);

-- Update an asset
UPDATE assets SET category = ?, description = ?, value = ? WHERE id = ? AND user_id = ?;

-- Delete an asset
DELETE FROM assets WHERE id = ? AND user_id = ?;

-- Total asset value for a user
SELECT COALESCE(SUM(value), 0) AS total_assets FROM assets WHERE user_id = ?;
```

### Dashboard Aggregate Queries

```sql
-- Net worth (assets minus liabilities)
SELECT
    (SELECT COALESCE(SUM(value), 0) FROM assets WHERE user_id = ?) -
    (SELECT COALESCE(SUM(balance), 0) FROM liabilities WHERE user_id = ?)
    AS net_worth;

-- Total annual income
SELECT COALESCE(SUM(
    CASE frequency
        WHEN 'weekly' THEN amount * 52
        WHEN 'monthly' THEN amount * 12
        WHEN 'annual' THEN amount
    END
), 0) AS annual_income FROM income WHERE user_id = ?;

-- Debt-to-asset ratio
SELECT
    COALESCE(SUM(l.balance), 0) AS total_liabilities,
    COALESCE((SELECT SUM(value) FROM assets WHERE user_id = ?), 0) AS total_assets
FROM liabilities l WHERE l.user_id = ?;

-- Upcoming insurance renewals (next 30 days)
SELECT * FROM protection
WHERE user_id = ? AND renewal_date BETWEEN DATE('now') AND DATE('now', '+30 days');

-- Estate planning completeness
SELECT
    COUNT(*) AS total_items,
    SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS completed_items
FROM estate WHERE user_id = ?;

-- Average intangible score
SELECT COALESCE(AVG(score), 0) AS avg_intangible_score FROM intangibles WHERE user_id = ?;
```

---

## Summary Checklist

| # | Task | Tool / Format |
|---|------|---------------|
| 1 | Write team intro paragraph | Word / Google Docs |
| 2 | Create ER diagram | dbdiagram.io → screenshot |
| 3 | Build 3–4 HTML/CSS prototype pages | VS Code → HTML files |
| 4 | Write route map table | Word / Markdown table |
| 5 | Write SQL queries (CREATE + CRUD + aggregates) | Code blocks in your report |

**Recommended order:** Start with Step 2 (DB diagram) → Step 5 (SQL) → Step 4 (route map) → Step 3 (prototypes) → Step 1 (intro).
