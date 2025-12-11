const express = require('express');
const { query, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get dashboard statistics
router.get('/stats',
  [
    query('start_date').optional().isDate(),
    query('end_date').optional().isDate()
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

      const { start_date, end_date } = req.query;

      // Build date filter
      let dateFilter = '';
      const queryParams = [req.user.id];
      let paramCount = 1;

      if (start_date) {
        paramCount++;
        dateFilter += ` AND appointment_date >= $${paramCount}`;
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        dateFilter += ` AND appointment_date <= $${paramCount}`;
        queryParams.push(end_date);
      }

      // Get total clients
      const clientsResult = await db.query(
        'SELECT COUNT(*) as total FROM clients WHERE user_id = $1',
        [req.user.id]
      );

      // Get total appointments
      const appointmentsResult = await db.query(
        `SELECT COUNT(*) as total FROM appointments WHERE user_id = $1${dateFilter}`,
        queryParams
      );

      // Get earnings (paid appointments only)
      const earningsResult = await db.query(
        `SELECT 
          COALESCE(SUM(price + tip), 0) as total_earnings,
          COALESCE(SUM(tip), 0) as total_tips
        FROM appointments 
        WHERE user_id = $1 AND paid = true${dateFilter}`,
        queryParams
      );

      // Get pending payments (unpaid appointments)
      const pendingResult = await db.query(
        `SELECT COALESCE(SUM(price + tip), 0) as pending
        FROM appointments 
        WHERE user_id = $1 AND paid = false${dateFilter}`,
        queryParams
      );

      // Get appointments by month (last 6 months)
      const monthlyResult = await db.query(
        `SELECT 
          TO_CHAR(appointment_date, 'YYYY-MM') as month,
          COUNT(*) as count,
          COALESCE(SUM(price + tip), 0) as revenue
        FROM appointments
        WHERE user_id = $1 AND appointment_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY TO_CHAR(appointment_date, 'YYYY-MM')
        ORDER BY month DESC`,
        [req.user.id]
      );

      res.json({
        success: true,
        stats: {
          total_clients: parseInt(clientsResult.rows[0].total),
          total_appointments: parseInt(appointmentsResult.rows[0].total),
          total_earnings: parseFloat(earningsResult.rows[0].total_earnings),
          total_tips: parseFloat(earningsResult.rows[0].total_tips),
          pending_payments: parseFloat(pendingResult.rows[0].pending),
          appointments_by_month: monthlyResult.rows.map(row => ({
            month: row.month,
            count: parseInt(row.count),
            revenue: parseFloat(row.revenue)
          }))
        }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Get recent appointments
router.get('/recent',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
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

      const limit = req.query.limit || 5;

      const result = await db.query(
        `SELECT 
          a.id,
          c.name as client_name,
          a.appointment_date,
          a.service,
          a.price,
          a.tip,
          a.paid
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        WHERE a.user_id = $1
        ORDER BY a.appointment_date DESC
        LIMIT $2`,
        [req.user.id, limit]
      );

      res.json({
        success: true,
        recent_appointments: result.rows
      });
    } catch (error) {
      console.error('Get recent appointments error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

module.exports = router;