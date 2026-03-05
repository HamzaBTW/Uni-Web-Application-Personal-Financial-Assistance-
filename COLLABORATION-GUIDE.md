# Collaboration Guide — Personal Financial Assistance

This guide explains how a new developer can work on this project in their own branch **without** causing database conflicts, merge issues, or breaking the application structure.

---

## How the Project Works

| Component       | Technology                                      |
| --------------- | ----------------------------------------------- |
| Backend         | Node.js + Express 5                             |
| Views           | EJS templates (`views/`)                        |
| Database        | SQLite via `better-sqlite3` (file: `data/finance.db`) |
| Auth            | `bcryptjs` + `express-session`                  |
| Schema          | Defined in `database/schema.sql`                |

The database is a **local file** (`data/finance.db`) that is auto-created when you start the app. It is **not committed to Git** — each developer gets their own copy.

---

## Getting Started (New Developer Setup)

### 1. Clone the Repository

```bash
git clone https://github.com/HamzaBTW/Uni-Web-Application-Personal-Financial-Assistance-.git
cd Uni-Web-Application-Personal-Financial-Assistance-
```

### 2. Create Your Own Branch

**Do NOT work directly on `main`.** Create a personal feature branch:

```bash
git checkout -b dev/your-name
```

For example:

```bash
git checkout -b dev/alex
```

### 3. Install Dependencies

```bash
npm install
```

This installs everything listed in `package.json` (Express, better-sqlite3, bcryptjs, EJS, express-session).

### 4. Start the Application

```bash
npm start
```

The server will start at **http://localhost:3000**.

On first launch, the app automatically:
1. Creates the `data/finance.db` SQLite file
2. Runs `database/schema.sql` to build all tables (users, income, assets, liabilities, protection, estate, intangibles)

**Your database is local and completely independent** — nothing you do will affect anyone else's data.

---

## Why There Are No Database Conflicts

The database file (`data/finance.db`) is listed in `.gitignore`:

```
node_modules/
data/*.db
data/*.db-wal
data/*.db-shm
```

This means:
- The `.db` file is **never pushed** to GitHub
- Each developer generates their **own database** locally when they run the app
- The schema (`database/schema.sql`) uses `CREATE TABLE IF NOT EXISTS`, so it is safe to re-run

**In short: you each have your own database. They never overlap.**

---

## Project Structure Overview

```
├── app.js              ← Main Express server (entry point)
├── database.js         ← Initialises SQLite + runs schema
├── package.json        ← Dependencies & scripts
├── .gitignore          ← Excludes node_modules/ and data/*.db
│
├── database/
│   └── schema.sql      ← All table definitions (shared via Git)
│
├── data/
│   └── finance.db      ← YOUR local database (NOT in Git)
│
├── routes/
│   └── auth.js         ← Authentication routes (login, signup, logout)
│
├── views/
│   ├── dashboard.ejs
│   ├── login.ejs
│   ├── signup.ejs
│   └── partials/
│       └── navbar.ejs
│
└── public/
    └── css/
        └── style.css
```

---

## Rules to Avoid Merge Conflicts

### Rule 0: Adding Shared Data (Seed Values)

To add rows that all contributors should have in their local database, append to `database/seed.sql`:

```sql
-- Always use INSERT OR IGNORE and an explicit id
INSERT OR IGNORE INTO income (id, user_id, source_type, description, amount, frequency, tax_band) VALUES
(3, 1, 'Freelance', 'Design work', 500, 'Monthly', 'Basic Rate');
```

**Rules:**
- Always use `INSERT OR IGNORE` — safe to re-run on every restart
- Always provide an explicit `id` so foreign key references stay consistent
- Append at the bottom — never edit or delete existing rows
- Commit the file to Git — everyone gets the data automatically on `npm start`

---

### Rule 1: Never Edit Existing Schema Columns — Only Add

If you need new tables or columns, **add them** to `database/schema.sql`. Do not rename or delete existing tables/columns that other developers depend on.

**Good — adding a new table:**
```sql
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    goal_name TEXT,
    target_amount REAL,
    current_amount REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Bad — renaming an existing column:**
```sql
-- DON'T DO THIS — it will break other people's code
ALTER TABLE income RENAME COLUMN source_type TO income_source;
```

### Rule 2: Work in Your Own Branch

```
main                ← stable, working code only
├── dev/hamza       ← Hamza's feature work
└── dev/alex        ← Alex's feature work
```

- Develop on your branch (`dev/your-name`)
- Only merge into `main` after testing and reviewing together
- Pull from `main` regularly to stay up to date:

```bash
git checkout dev/your-name
git pull origin main
```

### Rule 3: Keep Routes in Separate Files

If you are building a new feature (e.g., a budgeting page), create a **new route file**:

```
routes/
├── auth.js         ← (existing — don't modify unless necessary)
├── budget.js       ← your new feature
└── goals.js        ← another new feature
```

Then register it in `app.js`:

```javascript
const budgetRoutes = require('./routes/budget');
app.use(budgetRoutes);
```

This way, different developers' route files rarely conflict.

### Rule 4: Keep Views in Separate Files

Same principle — create new `.ejs` files for new pages rather than heavily modifying existing ones:

```
views/
├── dashboard.ejs   ← shared (be careful editing)
├── budget.ejs      ← your new page
├── goals.ejs       ← another new page
└── partials/
    └── navbar.ejs  ← shared (coordinate edits)
```

### Rule 5: Coordinate on Shared Files

Some files **will** need edits from both developers. These are:

| File                  | Why                                          | How to Coordinate                  |
| --------------------- | -------------------------------------------- | ---------------------------------- |
| `app.js`              | Registering new routes                       | Add your route at the bottom       |
| `database/schema.sql` | Adding new tables                            | Append new tables at the end       |
| `views/partials/navbar.ejs` | Adding nav links to new pages          | Add your link at the end of the nav |
| `public/css/style.css`| Styling new pages                            | Add your styles at the bottom      |

**Tip:** If you both append to the end of the same file, Git can usually auto-merge without conflicts.

---

## Branching Workflow (Step by Step)

### Starting a New Feature

```bash
# Make sure you're up to date
git checkout main
git pull origin main

# Create/switch to your branch
git checkout -b dev/your-name

# ... write code ...

# Stage and commit
git add .
git commit -m "Add budget tracking page"

# Push your branch
git push origin dev/your-name
```

### Merging Into Main

```bash
# First, pull latest main into your branch
git checkout dev/your-name
git pull origin main

# Fix any conflicts, then test the app

# When ready, merge into main
git checkout main
git pull origin main
git merge dev/your-name
git push origin main
```

Or use a **Pull Request** on GitHub (recommended) — this lets both developers review the code before merging.

---

## Quick Reference

| Question                                      | Answer                                                        |
| --------------------------------------------- | ------------------------------------------------------------- |
| Will our databases conflict?                   | **No** — each developer has their own local `data/finance.db` |
| Is the database committed to Git?              | **No** — it's in `.gitignore`                                 |
| How do I get the database tables?              | Run `npm start` — the schema runs automatically               |
| What if someone adds a new table?              | Pull their changes; restart the app — the new table is created |
| How do I avoid merge conflicts?                | Work on your own branch; add new files instead of editing existing ones |
| What if we both edit the same file?            | Append changes to the bottom; communicate before editing shared files |
| How do I stay up to date with `main`?          | `git pull origin main` from your branch regularly             |

---

## Database Access Policy

> ⚠️ **Protected files — admin approval required**
>
> The following files are protected by GitHub CODEOWNERS. Any Pull Request that touches them **requires explicit approval from @HamzaBTW** before it can be merged into `main`. Direct pushes to `main` are blocked entirely.
>
> | File | Protection |
> |---|---|
> | `database.js` | Admin only |
> | `database/schema.sql` | Admin only (you may append new tables) |
> | `database/seed.sql` | Admin only (you may append new rows) |

### What you CAN do:
- Append new tables to `database/schema.sql` (at the bottom, using `CREATE TABLE IF NOT EXISTS`)
- Append new seed rows to `database/seed.sql` (using `INSERT OR IGNORE`)
- Write `INSERT` and `SELECT` queries inside your own route files
- Create new route files that add or read data

### What you CANNOT do:
- Rename, alter, or delete existing tables or columns in `schema.sql`
- Write `DROP`, `DELETE`, or destructive `UPDATE` queries
- Edit `database.js` directly
- Open or manually edit `data/finance.db`
- Push directly to `main` — always use a Pull Request

---

## Summary

1. **Clone** the repo and create your own branch (`dev/your-name`)
2. **Run** `npm install` then `npm start` — your database is created automatically
3. **Build** new features in new files (routes, views, styles)
4. **Append** to shared files (`schema.sql`, `app.js`, `navbar.ejs`) at the bottom
5. **Never** modify or delete existing database columns/tables others depend on
6. **Merge** via Pull Requests on GitHub after reviewing together
7. **Database changes** require admin approval — see Database Access Policy above
