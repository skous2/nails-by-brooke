const express = require('express');
const { body, validationResult, query } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all appointments for the authenticated user
router.get('/', 
  [
    query('paid').optional().isBoolean().toBoolean(),
    query('start_date').optional().isDate(),
    query('end_date').optional().isDate(),
    query('client_id').optional().isInt()
  ],
  async (req, res) => {
    try {
      const { paid, start_date, end_date, client_id } = req.query;

      let queryText = `
        SELECT 
          a.id, 
          a.client_id, 
          c.name as client_name,
          a.appointment_date, 
          a.service, 
          a.price, 
          a.tip, 
          a.paid, 
          a.notes, 
          a.created_at, 
          a.updated_at
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        WHERE a.user_id = $1
      `;
      const queryParams = [req.user.id];
      let paramCount = 1;

      // Add filters
      if (paid !== undefined) {
        paramCount++;
        queryText += ` AND a.paid = $${paramCount}`;
        queryParams.push(paid);
      }

      if (start_date) {
        paramCount++;
        queryText += ` AND a.appointment_date >= $${paramCount}`;
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        queryText += ` AND a.appointment_date <= $${paramCount}`;
        queryParams.push(end_date);
      }

      if (client_id) {
        paramCount++;
        queryText += ` AND a.client_id = $${paramCount}`;
        queryParams.push(client_id);
      }

      queryText += ' ORDER BY a.appointment_date DESC';

      const result = await db.query(queryText, queryParams);

      res.json({
        success: true,
        appointments: result.rows
      });
    } catch (error) {
      console.error('Get appointments error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Get single appointment by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        a.id, 
        a.client_id, 
        c.name as client_name,
        a.appointment_date, 
        a.service, 
        a.price, 
        a.tip, 
        a.paid, 
        a.notes, 
        a.created_at, 
        a.updated_at
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.id = $1 AND a.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create a new appointment
router.post('/',
  [
    body('client_id').isInt().withMessage('Valid client ID is required'),
    body('appointment_date').isDate().withMessage('Valid date is required'),
    body('service').trim().notEmpty().withMessage('Service is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('tip').optional().isFloat({ min: 0 }),
    body('paid').optional().isBoolean(),
    body('notes').optional().trim()
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

      const { client_id, appointment_date, service, price, tip, paid, notes } = req.body;

      // Verify client belongs to user
      const clientCheck = await db.query(
        'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
        [client_id, req.user.id]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Client not found'
        });
      }

      // Create appointment
      const result = await db.query(
        `INSERT INTO appointments 
        (user_id, client_id, appointment_date, service, price, tip, paid, notes) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING id, client_id, appointment_date, service, price, tip, paid, notes, created_at, updated_at`,
        [req.user.id, client_id, appointment_date, service, price, tip || 0, paid || false, notes || null]
      );

      res.status(201).json({
        success: true,
        appointment: result.rows[0]
      });
    } catch (error) {
      console.error('Create appointment error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Update an appointment
router.put('/:id',
  [
    body('client_id').isInt().withMessage('Valid client ID is required'),
    body('appointment_date').isDate().withMessage('Valid date is required'),
    body('service').trim().notEmpty().withMessage('Service is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('tip').optional().isFloat({ min: 0 }),
    body('paid').optional().isBoolean(),
    body('notes').optional().trim()
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
      const { client_id, appointment_date, service, price, tip, paid, notes } = req.body;

      // Check if appointment exists and belongs to user
      const checkResult = await db.query(
        'SELECT id FROM appointments WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Appointment not found'
        });
      }

      // Verify client belongs to user
      const clientCheck = await db.query(
        'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
        [client_id, req.user.id]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Client not found'
        });
      }

      // Update appointment
      const result = await db.query(
        `UPDATE appointments 
        SET client_id = $1, appointment_date = $2, service = $3, price = $4, tip = $5, paid = $6, notes = $7
        WHERE id = $8 AND user_id = $9
        RETURNING id, client_id, appointment_date, service, price, tip, paid, notes, created_at, updated_at`,
        [client_id, appointment_date, service, price, tip || 0, paid || false, notes || null, id, req.user.id]
      );

      res.json({
        success: true,
        appointment: result.rows[0]
      });
    } catch (error) {
      console.error('Update appointment error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Update payment status only
router.patch('/:id/payment',
  [
    body('paid').isBoolean().withMessage('Paid status must be true or false')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: errors.array().map(e => e.msg)
        });
      }

      const { id } = req.params;
      const { paid } = req.body;

      const result = await db.query(
        'UPDATE appointments SET paid = $1 WHERE id = $2 AND user_id = $3 RETURNING id, paid',
        [paid, id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Appointment not found'
        });
      }

      res.json({
        success: true,
        appointment: result.rows[0]
      });
    } catch (error) {
      console.error('Update payment status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Delete an appointment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if appointment exists and belongs to user
    const checkResult = await db.query(
      'SELECT id FROM appointments WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Delete appointment
    await db.query(
      'DELETE FROM appointments WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;