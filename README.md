# Personal Financial Assistance

A comprehensive web application designed to help users manage and understand their complete financial picture. The application is organised into **7 key blocks**, each represented as a dedicated sub-page.

---

## Sub-Pages

### 1. Income & Tax

Tracks all sources of income and associated tax obligations.

- **Employment income** (salary, wages, bonuses)
- **Self-employment / freelance earnings**
- **Investment income** (dividends, interest, capital gains)
- **Rental income**
- **Tax calculations** (income tax bands, National Insurance, allowances)
- **Net take-home pay summary**

---

### 2. Assets (What You Own)

Catalogues everything the user owns that holds monetary value.

- **Cash & savings** (bank accounts, ISAs, emergency funds)
- **Investments** (stocks, bonds, mutual funds, crypto)
- **Property** (primary residence, buy-to-let)
- **Vehicles**
- **Valuables** (jewellery, art, collectibles)
- **Total asset valuation dashboard**

---

### 3. Liabilities (What You Owe)

Records all debts and financial obligations.

- **Mortgage balances**
- **Student loans**
- **Credit card debt**
- **Personal loans & car finance**
- **Outstanding bills / overdrafts**
- **Debt-to-asset ratio overview**

---

### 4. Protection (Insurance)

Manages all insurance policies that safeguard the user's finances and wellbeing.

- **Life insurance**
- **Health / medical insurance**
- **Home & contents insurance**
- **Vehicle insurance**
- **Income protection / critical illness cover**
- **Policy renewal dates & premium tracking**

---

### 5. Estate (Legal)

Covers legal and estate-planning documents and wishes.

- **Will status & details**
- **Power of Attorney**
- **Trusts**
- **Beneficiary designations**
- **Inheritance tax considerations**
- **Key legal contacts (solicitor, executor)**

---

### 6. Intangibles

Captures the non-physical, often overlooked factors that influence long-term financial health.

- **Skills & qualifications** (certifications, degrees — earning potential)
- **Professional network & reputation**
- **Intellectual property** (patents, trademarks, digital content)
- **Brand & online presence** (social-media reach, personal brand value)
- **Financial literacy score** (self-assessed knowledge & goals)
- **Health & wellbeing index** (lifestyle factors that affect future costs)

### 7. Signing Up

Setting Up the account, or creating a new account for a new user. 

- **Login in with email address** (Adding Username and password)
- **Seperate Sign Up Page** (Having a seperate place for new users to create their accounts)

---

## How Each Page Works

### 1. Income & Tax — Mechanisms

- **Input forms** let users enter income sources (salary, freelance, investments, rental) with amounts and frequency (weekly/monthly/annual).
- On submission, the form POSTs to `/income` which runs an `INSERT INTO income` query to store the entry in SQLite.
- **Tax calculator** applies UK income tax bands, National Insurance rates, and personal allowance automatically using server-side JavaScript.
- Deductions are subtracted to show a **net take-home pay** figure, calculated via SQL aggregation queries.
- All values stored in the `income` table in the SQLite database, scoped to the logged-in user via `user_id`.

### 2. Assets — Mechanisms

- Users **add asset entries** via a form — selecting a category (cash, investments, property, vehicles, valuables) and entering a value.
- The form POSTs to `/assets`, which inserts a row into the `assets` table in SQLite.
- Each asset is rendered as a card/row in a list; edit and delete actions trigger `UPDATE` and `DELETE` queries respectively.
- A **dashboard section** uses `SELECT SUM(value) ... GROUP BY category` to display a breakdown (e.g. pie chart or bar chart via Canvas/JS).
- Totals update on each page load by querying the database.

### 3. Liabilities — Mechanisms

- Similar CRUD mechanism to Assets — users add liabilities by category (mortgage, student loan, credit card, etc.) with outstanding balance and optional interest rate. Data is stored in the `liabilities` table.
- A **debt-to-asset ratio** is calculated automatically via SQL: `SELECT SUM(balance) FROM liabilities` divided by `SELECT SUM(value) FROM assets`, both filtered by `user_id`.
- Visual indicators (green/amber/red) flag healthy vs. concerning ratios.

### 4. Protection — Mechanisms

- Users log insurance policies via a form: type, provider, premium amount, start date, renewal date. Data is stored in the `protection` table.
- A **renewal tracker** highlights upcoming renewals using the SQL query: `SELECT * FROM protection WHERE user_id = ? AND renewal_date BETWEEN DATE('now') AND DATE('now', '+30 days')`.
- Policies displayed as cards with status badges (active / expiring soon / expired).
- Premium totals are calculated via `SELECT SUM(premium) FROM protection WHERE user_id = ?` to show monthly/annual protection costs.

### 5. Estate — Mechanisms

- Checklist-style UI — users mark items as complete/incomplete (e.g. "Will: ✓ drafted", "Power of Attorney: ✗ not set up"). Status changes trigger an `UPDATE estate SET status = ? WHERE id = ? AND user_id = ?` query.
- Text fields capture key details: solicitor name/contact, executor, beneficiary names — stored in the `estate` table.
- An **inheritance tax estimator** pulls total asset value from the database (`SELECT SUM(value) FROM assets WHERE user_id = ?`) and applies the UK nil-rate band (£325k) to estimate potential IHT liability.
- Progress bar shows overall estate-planning completeness, calculated via `SELECT COUNT(*), SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) FROM estate WHERE user_id = ?`.

### 6. Intangibles — Mechanisms

- Self-assessment sliders/forms for subjective metrics (financial literacy, health index, network strength) scored 1–10. Scores are stored in the `intangibles` table.
- Text entries for qualifications, IP holdings, and brand/online presence links.
- A **radar/spider chart** (drawn with Canvas or SVG) visualises scores across all intangible categories, populated by `SELECT category, score FROM intangibles WHERE user_id = ?`.
- Summary card shows an overall "intangible wealth" score via `SELECT AVG(score) FROM intangibles WHERE user_id = ?`.

### 7. Sign Up & Login — Mechanisms

#### Sign Up (`/signup`)

- **Registration form** with fields: email address, username, password, and confirm password.
- **Client-side validation** checks email format (regex), password strength (minimum 8 characters, mixed case, numbers), and that both password fields match.
- **Password hashing** uses `bcrypt` on the server to hash passwords before storing — plaintext passwords are never saved.
- **Duplicate check** — on submission, the server runs `SELECT COUNT(*) FROM users WHERE email = ?` to prevent duplicate registrations.
- **User storage** — accounts are stored in the `users` table in SQLite with columns: `id`, `email`, `username`, `password_hash`, `created_at`.
- **Success flow** — after successful registration the user is redirected to the login page.

#### Login (`/login`)

- **Login form** with email and password fields.
- **Credential verification** — the server fetches the user with `SELECT id, username, password_hash FROM users WHERE email = ?` and uses `bcrypt.compare()` to verify the password.
- **Session management** — on successful login, an Express session (`express-session`) stores the user's `id` and `username` server-side. A session cookie is sent to the browser.
- **Error handling** — inline error messages are displayed for incorrect email or password.
- **Logout** — a logout button in the shared `<nav>` hits `GET /logout`, which calls `req.session.destroy()` and redirects to `/login`.

#### Auth Guard (all protected routes)

- An Express **middleware function** (`requireAuth`) checks if `req.session.userId` exists before allowing access to any protected route. If no valid session is found, the user is redirected to `/login`.

#### User-Scoped Data (impact on all sub-pages)

- All database tables include a `user_id` foreign key referencing `users.id`.
- Every `SELECT`, `INSERT`, `UPDATE`, and `DELETE` query filters by `WHERE user_id = ?` using the session's `req.session.userId`.
- This means Income & Tax, Assets, Liabilities, Protection, Estate, and Intangibles data are all isolated per-user at the database level and never mixed between accounts.

#### Nav Bar Updates

- The shared `<nav>` displays the **logged-in username** and a **Logout** link when authenticated.
- **Sign Up** and **Login** links are hidden when the user is already logged in.
- The **Dashboard** greeting is personalised: *"Welcome back, [username]"*.

### Cross-Page Mechanisms

| Mechanism | How It Works |
|---|---|
| **Data persistence** | All user data stored in a **SQLite database** across 7 tables, each linked to the `users` table via a `user_id` foreign key. |
| **Navigation** | Shared `<nav>` partial/template across all pages links to each sub-page and the dashboard. |
| **Dashboard (`/`)** | The server runs aggregate SQL queries across all tables (assets, liabilities, income, protection, estate, intangibles) and renders a unified financial snapshot — net worth, income summary, protection status. |
| **Server routes** | Express routes in organised route files handle GET (display) and POST (create/update/delete) requests for each sub-page. |
| **Responsive layout** | CSS media queries ensure all forms, tables, and charts adapt to mobile/tablet/desktop. |
| **Form validation** | Client-side JavaScript validates required fields, numeric inputs, and date formats. Server-side validation provides a second layer of checks before running SQL queries. |
| **Authentication** | `bcrypt` hashes passwords on sign-up. Login compares hashes and creates an Express session. A `requireAuth` middleware protects all sub-page routes. |
| **Session management** | Express sessions (`express-session`) store the logged-in user's ID server-side. Sessions expire when the browser is closed or after a configurable timeout. |

---

## Tech Stack

- **Node.js** — server-side JavaScript runtime
- **Express** — web framework for routing & middleware
- **SQLite** (`better-sqlite3`) — lightweight file-based relational database
- **EJS** — templating engine for rendering HTML views
- **bcrypt** — password hashing
- **express-session** — server-side session management
- **HTML5** — semantic page structure
- **CSS3** — styling and responsive layout
- **JavaScript** — client-side interactivity (form validation, charts)

---

## Project Structure

```
Web_Assigment/
├── server.js                 # Express app entry point
├── package.json              # Dependencies & scripts
├── database.js               # SQLite setup & table creation
├── middleware/
│   └── auth.js               # requireAuth session middleware
├── routes/
│   ├── authRoutes.js         # Login, signup, logout
│   ├── dashboardRoutes.js    # Dashboard (GET /)
│   ├── incomeRoutes.js       # Income & Tax CRUD
│   ├── assetsRoutes.js       # Assets CRUD
│   ├── liabilitiesRoutes.js  # Liabilities CRUD
│   ├── protectionRoutes.js   # Protection CRUD
│   ├── estateRoutes.js       # Estate CRUD
│   └── intangiblesRoutes.js  # Intangibles CRUD
├── views/
│   ├── partials/
│   │   ├── nav.ejs           # Shared navigation bar
│   │   └── footer.ejs        # Shared footer
│   ├── layout.ejs            # Base layout template
│   ├── dashboard.ejs         # Landing / dashboard page
│   ├── login.ejs             # Login page
│   ├── signup.ejs            # Sign-up page
│   ├── income.ejs            # 1. Income & Tax
│   ├── assets.ejs            # 2. Assets
│   ├── liabilities.ejs       # 3. Liabilities
│   ├── protection.ejs        # 4. Protection (Insurance)
│   ├── estate.ejs            # 5. Estate (Legal)
│   └── intangibles.ejs       # 6. Intangibles
├── public/
│   ├── css/
│   │   └── style.css         # Global stylesheet
│   └── js/
│       └── main.js           # Client-side scripts (charts, validation)
├── data/
│   └── finance.db            # SQLite database file (auto-created)
└── README.md
```

---

## Getting Started

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` in your browser.
5. Create an account on the Sign Up page, then log in and navigate between the six blocks.

---

## Author

Hamza — DMU Module 7 Web Assignment

Shivam — DMU Module 7 Web Assignment

Rudra — DMU Module 7 Web Assignment
