const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all clients for the authenticated user
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, phone, email, notes, is_one_time_client, created_at, updated_at FROM clients WHERE user_id = $1 ORDER BY name ASC',
      [req.user.id]
    );

    res.json({
      success: true,
      clients: result.rows
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get single client by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT id, name, phone, email, notes, is_one_time_client, created_at, updated_at FROM clients WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    res.json({
      success: true,
      client: result.rows[0]
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create a new client
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email must be valid').normalizeEmail(),
    body('notes').optional({ checkFalsy: true }).trim(),
    body('is_one_time_client').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: errors.array().map(e => e.msg)
        });
      }

      let { name, phone, email, notes, is_one_time_client } = req.body;

      phone = phone === '' ? null : phone;
      email = email === '' ? null : email;
      notes = notes === '' ? null : notes;
      is_one_time_client = !!is_one_time_client;

      const result = await db.query(
        'INSERT INTO clients (user_id, name, phone, email, notes, is_one_time_client) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, phone, email, notes, is_one_time_client, created_at, updated_at',
        [req.user.id, name, phone, email, notes, is_one_time_client]
      );

      res.status(201).json({
        success: true,
        client: result.rows[0]
      });
    } catch (error) {
      console.error('Create client error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Update a client
router.put('/:id',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email must be valid').normalizeEmail(),
    body('notes').optional({ checkFalsy: true }).trim(),
    body('is_one_time_client').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: errors.array().map(e => e.msg)
        });
      }

      const { id } = req.params;
      const { name, phone, email, notes, is_one_time_client } = req.body;

      // Check if client exists and belongs to user
      const checkResult = await db.query(
        'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Client not found'
        });
      }

      // Update client
      const result = await db.query(
        'UPDATE clients SET name = $1, phone = $2, email = $3, notes = $4, is_one_time_client = $5 WHERE id = $6 AND user_id = $7 RETURNING id, name, phone, email, notes, is_one_time_client, created_at, updated_at',
        [name, phone, email || null, notes || null, !!is_one_time_client, id, req.user.id]
      );

      res.json({
        success: true,
        client: result.rows[0]
      });
    } catch (error) {
      console.error('Update client error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Delete a client
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if client exists and belongs to user
    const checkResult = await db.query(
      'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    // Delete client (appointments will be cascade deleted)
    await db.query(
      'DELETE FROM clients WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;