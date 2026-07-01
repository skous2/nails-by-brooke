const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/expenses?year=2025
router.get('/', auth, async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    let query = 'SELECT * FROM expenses WHERE user_id = $1';
    const params = [req.user.id];
    if (year) {
      query += ' AND EXTRACT(YEAR FROM expense_date) = $2';
      params.push(year);
    }
    query += ' ORDER BY expense_date DESC';
    const result = await db.query(query, params);
    res.json({ success: true, expenses: result.rows });
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch expenses' });
  }
});

// POST /api/expenses
router.post('/', auth, async (req, res) => {
  const { expense_date, description, amount, payment_method } = req.body;
  if (!expense_date || !description || !amount) {
    return res.status(400).json({ success: false, error: 'Date, description, and amount are required' });
  }
  try {
    const result = await db.query(
      `INSERT INTO expenses (user_id, expense_date, description, amount, payment_method)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, expense_date, description, amount, payment_method || null]
    );
    res.status(201).json({ success: true, expense: result.rows[0] });
  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(500).json({ success: false, error: 'Failed to create expense' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', auth, async (req, res) => {
  const { expense_date, description, amount, payment_method } = req.body;
  if (!expense_date || !description || !amount) {
    return res.status(400).json({ success: false, error: 'Date, description, and amount are required' });
  }
  try {
    const result = await db.query(
      `UPDATE expenses SET expense_date=$1, description=$2, amount=$3, payment_method=$4
       WHERE id=$5 AND user_id=$6 RETURNING *`,
      [expense_date, description, amount, payment_method || null, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    res.json({ success: true, expense: result.rows[0] });
  } catch (err) {
    console.error('Error updating expense:', err);
    res.status(500).json({ success: false, error: 'Failed to update expense' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM expenses WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ success: false, error: 'Failed to delete expense' });
  }
});

module.exports = router;
