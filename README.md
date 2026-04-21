# Expense Tracker

A minimal full-stack personal expense tracker built with Node.js, Express, SQLite, and vanilla JavaScript.

## Live Demo

> Deployed on Render: [https://expense-tracker-porq.onrender.com](https://expense-tracker-porq.onrender.com)

---

## Features

- Add expenses with amount, category, description, and date
- View all expenses sorted by date (newest first)
- Filter expenses by category
- See total amount for the currently visible list
- Summary breakdown by category
- Handles duplicate submissions and page refreshes gracefully (idempotent API)

---

## Tech Stack

| Layer      | Choice              | Reason                                                                 |
|------------|---------------------|------------------------------------------------------------------------|
| Backend    | Node.js + Express   | Lightweight, fast, well-known                                          |
| Database   | SQLite (better-sqlite3) | Zero-config, file-based, synchronous API — ideal for this scope    |
| Frontend   | Vanilla JS + HTML   | No build step, fast to load, zero dependencies                         |
| Hosting    | Render.com          | Native Node.js support, deploys directly from GitHub                   |

---

## Key Design Decisions

### Money as integers (paise)
All monetary amounts are stored as integers in **paise** (1 INR = 100 paise) to avoid IEEE 754 floating-point rounding errors. Amounts are converted to/from rupees only at the API boundary.

### Idempotent POST /expenses
The client generates a UUID `idempotency_key` per form session. If the same key is submitted twice (e.g., double-click, network retry), the server returns the existing record instead of creating a duplicate. The key is regenerated only after a successful submission.

### SQLite over in-memory / JSON file
SQLite provides ACID guarantees, real query filtering (by category), and indexed sorting — things a JSON file cannot do safely. WAL mode is enabled for better read concurrency.

### Single HTML frontend
No bundler, no framework, no build step. The entire UI is one `public/index.html` file served by Express. This keeps deployment simple and eliminates a whole class of build-time failures.

---

## Trade-offs 

- **No authentication** — this is a personal tool assumed to be single-user
- **SQLite instead of PostgreSQL** — SQLite resets on Render free-tier redeploys; a production system would use a managed DB (e.g., Supabase, PlanetScale, Render PostgreSQL)
- **No pagination** — acceptable for personal finance data volumes
- **No edit/delete** — not required by the spec; would be the next feature to add

---

## What I intentionally did NOT do

- No TypeScript (would add value in a team setting, not within this timebox)
- No React (vanilla JS is sufficient; React would add complexity without user-visible benefit here)
- No unit tests (would add them for the validation and money-conversion logic in production)

---

## Running Locally

```bash
# Clone
git clone https://github.com/your-username/expense-tracker.git
cd expense-tracker

# Install
npm install

# Start
npm start
# → http://localhost:3000
```

## API Reference

### POST /expenses

Creates a new expense.

**Request body:**
```json
{
  "amount": "250.00",
  "category": "Food",
  "description": "Lunch at Swiggy",
  "date": "2025-04-21",
  "idempotency_key": "uuid-v4-string"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "expense": {
    "id": "uuid",
    "amount": "250.00",
    "category": "Food",
    "description": "Lunch at Swiggy",
    "date": "2025-04-21",
    "created_at": "2025-04-21T10:00:00.000Z"
  }
}
```

Returns `200` (not `201`) if the `idempotency_key` matches an existing record.

---

### GET /expenses

Returns all expenses.

**Query params:**
- `category` — filter by category name
- `sort=date_desc` — sort by date descending (default)

**Response:**
```json
{
  "success": true,
  "expenses": [...],
  "total": "1250.00",
  "categories": ["Food", "Transport"]
}
```

---

## Deployment (Render)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Set:
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
5. Deploy ✓