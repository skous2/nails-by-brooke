const express = require('express');
const { body, validationResult, query } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const ALLOWED_PAYMENT_TYPES = ['Venmo', 'Cash', 'Bank Transfer', 'Other'];

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Joins each appointment to its payment-method breakdown (appointment_payments).
// Exposes `payments` (full breakdown array) and `payment_type` (a derived
// "Cash + Venmo" style summary string, kept for display compatibility).
const PAYMENT_JOIN_SQL = `
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(json_agg(json_build_object(
        'payment_type', ap.payment_type,
        'amount_price', ap.amount_price,
        'amount_tip', ap.amount_tip
      ) ORDER BY ap.id), '[]'::json) AS payments,
      string_agg(DISTINCT ap.payment_type, ' + ' ORDER BY ap.payment_type) AS payment_type
    FROM appointment_payments ap
    WHERE ap.appointment_id = a.id
  ) pmt ON true
`;

const summarizePaymentTypes = (payments) => {
  if (!payments || payments.length === 0) return null;
  return [...new Set(payments.map((p) => p.payment_type))].sort().join(' + ');
};

// Validates a payments[] array against the appointment's price/tip totals.
// Returns an error message string, or null if valid.
const validatePayments = (payments, price, tip) => {
  if (!Array.isArray(payments) || payments.length === 0) {
    return 'At least one payment method is required for a paid appointment';
  }

  for (const p of payments) {
    if (!p || typeof p !== 'object' || !ALLOWED_PAYMENT_TYPES.includes(p.payment_type)) {
      return `Each payment must have a payment_type of ${ALLOWED_PAYMENT_TYPES.join(', ')}`;
    }
    const amountPrice = parseFloat(p.amount_price);
    const amountTip = parseFloat(p.amount_tip);
    if (isNaN(amountPrice) || amountPrice < 0 || isNaN(amountTip) || amountTip < 0) {
      return 'Payment amounts must be 0 or more';
    }
  }

  const EPSILON = 0.01;
  const sumPrice = payments.reduce((sum, p) => sum + parseFloat(p.amount_price || 0), 0);
  const sumTip = payments.reduce((sum, p) => sum + parseFloat(p.amount_tip || 0), 0);

  if (Math.abs(sumPrice - parseFloat(price)) > EPSILON) {
    return `Payment amounts toward price ($${sumPrice.toFixed(2)}) must add up to the service price ($${parseFloat(price).toFixed(2)})`;
  }
  if (Math.abs(sumTip - parseFloat(tip || 0)) > EPSILON) {
    return `Payment amounts toward tip ($${sumTip.toFixed(2)}) must add up to the tip ($${parseFloat(tip || 0).toFixed(2)})`;
  }

  return null;
};

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
          pmt.payment_type,
          pmt.payments,
          a.price,
          a.tip,
          a.paid,
          a.notes,
          a.created_at,
          a.updated_at
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        ${PAYMENT_JOIN_SQL}
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
        pmt.payment_type,
        pmt.payments,
        a.price,
        a.tip,
        a.paid,
        a.notes,
        a.created_at,
        a.updated_at
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      ${PAYMENT_JOIN_SQL}
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
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('tip').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Tip must be 0 or more'),
    body('paid').optional().isBoolean(),
    body('notes').optional().trim()
  ],
  async (req, res) => {
    let client;
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

      const { client_id, appointment_date, price, tip, paid, notes, payments } = req.body;
      const isPaid = !!paid;

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

      // Payment breakdown is only required (and validated) once marked paid
      const paymentsToInsert = isPaid ? payments : [];
      if (isPaid) {
        const validationMsg = validatePayments(payments, price, tip);
        if (validationMsg) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            message: validationMsg,
          });
        }
      }

      client = await db.getClient();
      await client.query('BEGIN');

      const apptResult = await client.query(
        `INSERT INTO appointments
        (user_id, client_id, appointment_date, price, tip, paid, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, client_id, appointment_date, price, tip, paid, notes, created_at, updated_at`,
        [req.user.id, client_id, appointment_date, price, tip || 0, isPaid, notes || null]
      );
      const appointment = apptResult.rows[0];

      for (const p of paymentsToInsert) {
        await client.query(
          `INSERT INTO appointment_payments (appointment_id, payment_type, amount_price, amount_tip)
           VALUES ($1, $2, $3, $4)`,
          [appointment.id, p.payment_type, parseFloat(p.amount_price) || 0, parseFloat(p.amount_tip) || 0]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        appointment: {
          ...appointment,
          payments: paymentsToInsert,
          payment_type: summarizePaymentTypes(paymentsToInsert),
        }
      });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error('Create appointment error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    } finally {
      if (client) client.release();
    }
  }
);

// Update an appointment
router.put('/:id',
  [
    body('client_id').isInt().withMessage('Valid client ID is required'),
    body('appointment_date').isDate().withMessage('Valid date is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('tip').optional().isFloat({ min: 0 }),
    body('paid').optional().isBoolean(),
    body('notes').optional().trim()
  ],
  async (req, res) => {
    let client;
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
      const { client_id, appointment_date, price, tip, paid, notes, payments } = req.body;
      const isPaid = !!paid;

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

      const paymentsToInsert = isPaid ? payments : [];
      if (isPaid) {
        const validationMsg = validatePayments(payments, price, tip);
        if (validationMsg) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            message: validationMsg,
          });
        }
      }

      client = await db.getClient();
      await client.query('BEGIN');

      // Update appointment
      const result = await client.query(
        `UPDATE appointments
        SET client_id = $1, appointment_date = $2, price = $3, tip = $4, paid = $5, notes = $6
        WHERE id = $7 AND user_id = $8
        RETURNING id, client_id, appointment_date, price, tip, paid, notes, created_at, updated_at`,
        [client_id, appointment_date, price, tip || 0, isPaid, notes || null, id, req.user.id]
      );
      const appointment = result.rows[0];

      // Replace the payment breakdown wholesale
      await client.query('DELETE FROM appointment_payments WHERE appointment_id = $1', [id]);
      for (const p of paymentsToInsert) {
        await client.query(
          `INSERT INTO appointment_payments (appointment_id, payment_type, amount_price, amount_tip)
           VALUES ($1, $2, $3, $4)`,
          [id, p.payment_type, parseFloat(p.amount_price) || 0, parseFloat(p.amount_tip) || 0]
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        appointment: {
          ...appointment,
          payments: paymentsToInsert,
          payment_type: summarizePaymentTypes(paymentsToInsert),
        }
      });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error('Update appointment error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    } finally {
      if (client) client.release();
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
