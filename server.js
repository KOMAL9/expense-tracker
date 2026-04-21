const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { createExpense, getExpenses, getCategories } = require("./src/db");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_CATEGORIES = ["Food", "Transport", "Shopping", "Health", "Entertainment", "Utilities", "Other"];

function validateExpense({ amount, category, description, date }) {
  const errors = [];

  // Amount: must be a valid positive number
  const parsedAmount = parseFloat(amount);
  if (amount === undefined || amount === null || amount === "") {
    errors.push("amount is required");
  } else if (isNaN(parsedAmount) || parsedAmount <= 0) {
    errors.push("amount must be a positive number");
  } else if (parsedAmount > 10_000_000) {
    errors.push("amount exceeds maximum allowed value");
  }

  // Category
  if (!category || !category.trim()) {
    errors.push("category is required");
  } else if (!VALID_CATEGORIES.includes(category.trim())) {
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  // Description
  if (!description || !description.trim()) {
    errors.push("description is required");
  } else if (description.trim().length > 500) {
    errors.push("description must be 500 characters or fewer");
  }

  // Date: must be a valid ISO date string YYYY-MM-DD
  if (!date || !date.trim()) {
    errors.push("date is required");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    errors.push("date must be in YYYY-MM-DD format");
  } else {
    const d = new Date(date.trim());
    if (isNaN(d.getTime())) errors.push("date is not a valid calendar date");
  }

  return errors;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /expenses
 * Create a new expense.
 * Supports idempotency via `idempotency_key` in request body.
 * Amount is accepted in rupees (decimal) and stored as paise (integer).
 */
app.post("/expenses", (req, res) => {
  try {
    const { amount, category, description, date, idempotency_key } = req.body;

    const errors = validateExpense({ amount, category, description, date });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Convert rupees to paise (integer) to avoid floating point issues
    // Round to nearest paisa to handle inputs like 10.999
    const amountInPaise = Math.round(parseFloat(amount) * 100);

    const now = new Date().toISOString();
    const { expense, created } = createExpense({
      id: uuidv4(),
      amount: amountInPaise,
      category: category.trim(),
      description: description.trim(),
      date: date.trim(),
      created_at: now,
      idempotency_key: idempotency_key || null,
    });

    // 200 if idempotent replay, 201 if newly created
    return res.status(created ? 201 : 200).json({ success: true, expense });
  } catch (err) {
    console.error("POST /expenses error:", err);
    return res.status(500).json({ success: false, errors: ["Internal server error"] });
  }
});

/**
 * GET /expenses
 * Returns list of expenses.
 * Query params:
 *   category (string)       — filter by category
 *   sort=date_desc          — sort by date descending (default)
 */
app.get("/expenses", (req, res) => {
  try {
    const { category, sort } = req.query;
    const expenses = getExpenses({ category, sort });
    const categories = getCategories();

    // Compute total in paise first, then convert to avoid float errors
    const totalPaise = expenses.reduce((sum, e) => sum + Math.round(parseFloat(e.amount) * 100), 0);
    const total = (totalPaise / 100).toFixed(2);

    return res.status(200).json({ success: true, expenses, total, categories });
  } catch (err) {
    console.error("GET /expenses error:", err);
    return res.status(500).json({ success: false, errors: ["Internal server error"] });
  }
});

/**
 * GET /health
 * Health check endpoint for Render.
 */
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Catch-all: serve frontend for any unmatched route ────────────────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Expense Tracker API running on port ${PORT}`);
});

module.exports = app;