const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "expenses.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create expenses table
// amount stored as INTEGER in paise (1 INR = 100 paise) to avoid floating point issues
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id          TEXT PRIMARY KEY,
    amount      INTEGER NOT NULL CHECK(amount > 0),
    category    TEXT NOT NULL,
    description TEXT NOT NULL,
    date        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    idempotency_key TEXT UNIQUE
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(date DESC);
  CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
  CREATE INDEX IF NOT EXISTS idx_idempotency_key   ON expenses(idempotency_key);
`);

/**
 * Insert a new expense.
 * Returns the created expense or the existing one if idempotency_key matches.
 * Amount is expected in paise (integer).
 */
function createExpense({ id, amount, category, description, date, created_at, idempotency_key }) {
  // Check idempotency: if same key exists, return existing record
  if (idempotency_key) {
    const existing = db
      .prepare("SELECT * FROM expenses WHERE idempotency_key = ?")
      .get(idempotency_key);
    if (existing) return { expense: formatExpense(existing), created: false };
  }

  const stmt = db.prepare(`
    INSERT INTO expenses (id, amount, category, description, date, created_at, idempotency_key)
    VALUES (@id, @amount, @category, @description, @date, @created_at, @idempotency_key)
  `);

  stmt.run({ id, amount, category, description, date, created_at, idempotency_key });

  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  return { expense: formatExpense(expense), created: true };
}

/**
 * Get expenses with optional category filter and date sort.
 */
function getExpenses({ category, sort } = {}) {
  let query = "SELECT * FROM expenses";
  const params = [];

  if (category && category !== "all") {
    query += " WHERE category = ?";
    params.push(category);
  }

  // Default to newest first; support explicit asc
  const order = sort === "date_asc" ? "ASC" : "DESC";
  query += ` ORDER BY date ${order}, created_at ${order}`;

  const rows = db.prepare(query).all(...params);
  return rows.map(formatExpense);
}

/**
 * Get distinct categories for filter dropdown.
 */
function getCategories() {
  const rows = db.prepare("SELECT DISTINCT category FROM expenses ORDER BY category ASC").all();
  return rows.map((r) => r.category);
}

/**
 * Convert DB row to API-friendly format.
 * Converts paise back to rupees as a string to preserve precision.
 */
function formatExpense(row) {
  return {
    id: row.id,
    amount: (row.amount / 100).toFixed(2),   // paise → rupees, always 2 decimal places
    category: row.category,
    description: row.description,
    date: row.date,
    created_at: row.created_at,
  };
}

module.exports = { createExpense, getExpenses, getCategories };