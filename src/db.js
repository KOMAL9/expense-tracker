const path = require("path");
const fs   = require("fs");

const initSqlJs = require("sql.js");

const DB_PATH = path.join(__dirname, "..", "expenses.db");

let db;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id              TEXT PRIMARY KEY,
      amount          INTEGER NOT NULL CHECK(amount > 0),
      category        TEXT NOT NULL,
      description     TEXT NOT NULL,
      date            TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      idempotency_key TEXT UNIQUE
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_idempotency_key   ON expenses(idempotency_key);
  `);

  persistDb();
  console.log("Database initialised at", DB_PATH);
}

function persistDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function createExpense({ id, amount, category, description, date, created_at, idempotency_key }) {
  if (idempotency_key) {
    const existing = db.exec("SELECT * FROM expenses WHERE idempotency_key = ?", [idempotency_key]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return { expense: rowToExpense(existing[0].columns, existing[0].values[0]), created: false };
    }
  }

  db.run(
    `INSERT INTO expenses (id, amount, category, description, date, created_at, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, amount, category, description, date, created_at, idempotency_key || null]
  );

  persistDb();

  const result = db.exec("SELECT * FROM expenses WHERE id = ?", [id]);
  return { expense: rowToExpense(result[0].columns, result[0].values[0]), created: true };
}

function getExpenses({ category, sort } = {}) {
  let query = "SELECT * FROM expenses";
  const params = [];

  if (category && category !== "all") {
    query += " WHERE category = ?";
    params.push(category);
  }

  const order = sort === "date_asc" ? "ASC" : "DESC";
  query += ` ORDER BY date ${order}, created_at ${order}`;

  const result = db.exec(query, params);
  if (!result.length) return [];
  return result[0].values.map((row) => rowToExpense(result[0].columns, row));
}

function getCategories() {
  const result = db.exec("SELECT DISTINCT category FROM expenses ORDER BY category ASC");
  if (!result.length) return [];
  return result[0].values.map((r) => r[0]);
}

function rowToExpense(columns, values) {
  const row = {};
  columns.forEach((col, i) => { row[col] = values[i]; });
  return {
    id:          row.id,
    amount:      (row.amount / 100).toFixed(2),
    category:    row.category,
    description: row.description,
    date:        row.date,
    created_at:  row.created_at,
  };
}

module.exports = { initDb, createExpense, getExpenses, getCategories };