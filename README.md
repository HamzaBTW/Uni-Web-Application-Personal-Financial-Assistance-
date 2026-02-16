# Personal Financial Assistance

A comprehensive web application designed to help users manage and understand their complete financial picture. The application is organised into **6 key blocks**, each represented as a dedicated sub-page.

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

---

## How Each Page Works

### 1. Income & Tax — Mechanisms

- **Input forms** let users enter income sources (salary, freelance, investments, rental) with amounts and frequency (weekly/monthly/annual).
- **Tax calculator** applies UK income tax bands, National Insurance rates, and personal allowance automatically using JavaScript.
- Deductions are subtracted in real time to show a **net take-home pay** figure.
- All values stored in `localStorage` so data persists between sessions.

### 2. Assets — Mechanisms

- Users **add asset entries** via a form — selecting a category (cash, investments, property, vehicles, valuables) and entering a value.
- Each asset is rendered as a card/row in a list, editable and deletable.
- A **dashboard section** sums all asset values and displays a breakdown (e.g. pie chart or bar chart via Canvas/JS).
- Totals update dynamically whenever an entry is added, edited, or removed.

### 3. Liabilities — Mechanisms

- Similar CRUD mechanism to Assets — users add liabilities by category (mortgage, student loan, credit card, etc.) with outstanding balance and optional interest rate.
- A **debt-to-asset ratio** is calculated automatically by pulling the total from the Assets page (`localStorage`) and dividing liabilities by assets.
- Visual indicators (green/amber/red) flag healthy vs. concerning ratios.

### 4. Protection — Mechanisms

- Users log insurance policies via a form: type, provider, premium amount, start date, renewal date.
- A **renewal tracker** highlights upcoming renewals (e.g. within 30 days) using date comparison in JS.
- Policies displayed as cards with status badges (active / expiring soon / expired).
- Premium totals are summed to show monthly/annual protection costs.

### 5. Estate — Mechanisms

- Checklist-style UI — users mark items as complete/incomplete (e.g. "Will: ✓ drafted", "Power of Attorney: ✗ not set up").
- Text fields capture key details: solicitor name/contact, executor, beneficiary names.
- An **inheritance tax estimator** pulls total asset value from `localStorage` and applies the UK nil-rate band (£325k) to estimate potential IHT liability.
- Progress bar shows overall estate-planning completeness.

### 6. Intangibles — Mechanisms

- Self-assessment sliders/forms for subjective metrics (financial literacy, health index, network strength) scored 1–10.
- Text entries for qualifications, IP holdings, and brand/online presence links.
- A **radar/spider chart** (drawn with Canvas or SVG) visualises scores across all intangible categories.
- Summary card shows an overall "intangible wealth" score as a weighted average.

### Cross-Page Mechanisms

| Mechanism | How It Works |
|---|---|
| **Data persistence** | All user data saved to `localStorage` as JSON objects, keyed per page. |
| **Navigation** | Shared `<nav>` bar across all pages links to each sub-page and the dashboard. |
| **Dashboard (index.html)** | Pulls totals from each page's `localStorage` data and renders a unified financial snapshot — net worth (assets − liabilities), income summary, protection status. |
| **Shared JS (`main.js`)** | Contains reusable functions: `saveData()`, `loadData()`, `formatCurrency()`, `calculateTotal()`, nav highlighting, form validation. |
| **Responsive layout** | CSS media queries ensure all forms, tables, and charts adapt to mobile/tablet/desktop. |
| **Form validation** | JavaScript validates required fields, numeric inputs, and date formats before saving. |

---

## Tech Stack

- **HTML5** — semantic page structure
- **CSS3** — styling and responsive layout
- **JavaScript** — interactivity and client-side logic

---

## Project Structure

```
Web_Assigment/
├── index.html              # Landing / dashboard page
├── income-tax.html         # 1. Income & Tax
├── assets.html             # 2. Assets
├── liabilities.html        # 3. Liabilities
├── protection.html         # 4. Protection (Insurance)
├── estate.html             # 5. Estate (Legal)
├── intangibles.html        # 6. Intangibles
├── css/
│   └── style.css           # Global stylesheet
├── js/
│   └── main.js             # Shared scripts
└── README.md
```

---

## Getting Started

1. Clone or download the repository.
2. Open `index.html` in any modern web browser.
3. Navigate between the six blocks using the site navigation.

---

## Author

Hamza — DMU Module 7 Web Assignment
Shivam — DMU Module 7 Web Assignment
Rudra — DMU Module 7 Web Assignment
