// routes/reports.js
const express = require('express');
const PDFDocument = require('pdfkit');
const router = express.Router();

const db = require('../db');
const auth = require('../middleware/auth');

// Helper: get numeric year, default to current
function getYearFromQuery(queryYear) {
  const now = new Date();
  const y = parseInt(queryYear, 10);
  if (!isNaN(y) && y > 2000 && y < 2100) return y;
  return now.getFullYear();
}

// GET /api/reports/summary?year=2025
// Returns monthly + annual totals (paid appointments only)
router.get('/summary', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = getYearFromQuery(req.query.year);

    // Monthly breakdown for a given year
    const monthlyResult = await db.query(
      `
      SELECT
        EXTRACT(MONTH FROM appointment_date)::int AS month,
        SUM(price)::numeric(10,2) AS service_total,
        SUM(tip)::numeric(10,2) AS tip_total,
        SUM(price + tip)::numeric(10,2) AS grand_total
      FROM appointments
      WHERE user_id = $1
        AND paid = true
        AND EXTRACT(YEAR FROM appointment_date) = $2
      GROUP BY month
      ORDER BY month;
      `,
      [userId, year]
    );

    // Annual breakdown across all years
    const annualResult = await db.query(
      `
      SELECT
        EXTRACT(YEAR FROM appointment_date)::int AS year,
        SUM(price)::numeric(10,2) AS service_total,
        SUM(tip)::numeric(10,2) AS tip_total,
        SUM(price + tip)::numeric(10,2) AS grand_total
      FROM appointments
      WHERE user_id = $1
        AND paid = true
      GROUP BY year
      ORDER BY year DESC;
      `,
      [userId]
    );

    res.json({
      success: true,
      year,
      monthly: monthlyResult.rows,
      annual: annualResult.rows,
    });
  } catch (err) {
    console.error('Error generating summary report:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary report',
    });
  }
});

// GET /api/reports/summary/pdf?year=2025
// Returns a PDF file with the same info
router.get('/summary/pdf', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = getYearFromQuery(req.query.year);

    // Pull the same data as JSON endpoint
    const monthlyResult = await db.query(
      `
      SELECT
        EXTRACT(MONTH FROM appointment_date)::int AS month,
        SUM(price)::numeric(10,2) AS service_total,
        SUM(tip)::numeric(10,2) AS tip_total,
        SUM(price + tip)::numeric(10,2) AS grand_total
      FROM appointments
      WHERE user_id = $1
        AND paid = true
        AND EXTRACT(YEAR FROM appointment_date) = $2
      GROUP BY month
      ORDER BY month;
      `,
      [userId, year]
    );

    const annualResult = await db.query(
      `
      SELECT
        EXTRACT(YEAR FROM appointment_date)::int AS year,
        SUM(price)::numeric(10,2) AS service_total,
        SUM(tip)::numeric(10,2) AS tip_total,
        SUM(price + tip)::numeric(10,2) AS grand_total
      FROM appointments
      WHERE user_id = $1
        AND paid = true
      GROUP BY year
      ORDER BY year DESC;
      `,
      [userId]
    );

    // Start PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nails-by-brooke-income-report-${year}.pdf"`
    );

    doc.pipe(res);

    // Title
    doc
      .fontSize(20)
      .text('Nails by Brooke – Income Report', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(14)
      .text(`Year: ${year}`, { align: 'center' })
      .moveDown(1.5);

    // Helper for money formatting
    const fmt = (n) =>
      typeof n === 'number'
        ? n.toFixed(2)
        : parseFloat(n || 0).toFixed(2);

    // Monthly section
    doc
      .fontSize(16)
      .text('Monthly Summary (Paid Appointments)', { underline: true })
      .moveDown(0.5);

    if (monthlyResult.rows.length === 0) {
      doc.fontSize(12).text('No paid appointments for this year.').moveDown(1);
    } else {
      doc
        .fontSize(12)
        .text('Month   Service   Tips   Total', { continued: false });

      monthlyResult.rows.forEach((row) => {
        const monthName = new Date(year, row.month - 1, 1).toLocaleString(
          'default',
          { month: 'short' }
        );

        doc.text(
          `${monthName.padEnd(7)} $${fmt(
            row.service_total
          )}   $${fmt(row.tip_total)}   $${fmt(row.grand_total)}`
        );
      });

      doc.moveDown(1.5);
    }

    // Annual section
    doc
      .fontSize(16)
      .text('Annual Summary (All Years, Paid Appointments)', {
        underline: true,
      })
      .moveDown(0.5);

    if (annualResult.rows.length === 0) {
      doc.fontSize(12).text('No data yet.').moveDown(1);
    } else {
      doc
        .fontSize(12)
        .text('Year   Service   Tips   Total', { continued: false });

      annualResult.rows.forEach((row) => {
        doc.text(
          `${String(row.year).padEnd(6)} $${fmt(
            row.service_total
          )}   $${fmt(row.tip_total)}   $${fmt(row.grand_total)}`
        );
      });

      doc.moveDown(1.5);
    }

    doc.fontSize(10).text(
      'Note: This report includes only PAID appointments (paid = true).',
      { align: 'left' }
    );

    doc.end();
  } catch (err) {
    console.error('Error generating PDF report:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF report',
      });
    }
  }
});

module.exports = router;
