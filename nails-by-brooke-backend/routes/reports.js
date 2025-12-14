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

// ============================
// SUMMARY REPORT (JSON + PDF)
// ============================

// GET /api/reports/summary?year=2025
router.get('/summary', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = getYearFromQuery(req.query.year);

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
router.get('/summary/pdf', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = getYearFromQuery(req.query.year);

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

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nails-by-brooke-income-summary-${year}.pdf"`
    );

    doc.pipe(res);

    const fmt = (n) =>
      typeof n === 'number'
        ? n.toFixed(2)
        : parseFloat(n || 0).toFixed(2);

    doc
      .fontSize(20)
      .text('Nails by Brooke – Income Summary', { align: 'center' })
      .moveDown(0.5);

    doc.fontSize(14).text(`Year: ${year}`, { align: 'center' }).moveDown(1.5);

    // Monthly
    doc
      .fontSize(16)
      .text('Monthly Summary (Paid Appointments)', { underline: true })
      .moveDown(0.5);

    if (monthlyResult.rows.length === 0) {
      doc.fontSize(12).text('No paid appointments for this year.').moveDown(1);
    } else {
      doc.fontSize(12).text('Month   Service   Tips   Total');
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

    // Annual
    doc
      .fontSize(16)
      .text('Annual Summary (All Years, Paid Appointments)', {
        underline: true,
      })
      .moveDown(0.5);

    if (annualResult.rows.length === 0) {
      doc.fontSize(12).text('No data yet.').moveDown(1);
    } else {
      doc.fontSize(12).text('Year   Service   Tips   Total');
      annualResult.rows.forEach((row) => {
        doc.text(
          `${String(row.year).padEnd(6)} $${fmt(
            row.service_total
          )}   $${fmt(row.tip_total)}   $${fmt(row.grand_total)}`
        );
      });
      doc.moveDown(1.5);
    }

    doc
      .fontSize(10)
      .text(
        'Note: This summary includes only appointments marked as paid.',
        { align: 'left' }
      );

    doc.end();
  } catch (err) {
    console.error('Error generating summary PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF report',
      });
    }
  }
});

// ============================
// DETAILED REPORT (JSON + PDF + CSV)
// ============================

// GET /api/reports/detailed?year=2025&client_id=123
router.get('/detailed', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = getYearFromQuery(req.query.year);
    const clientId = req.query.client_id || null;

    const params = [userId, year];
    let clientFilter = '';

    if (clientId) {
      params.push(clientId);
      clientFilter = 'AND a.client_id = $3';
    }

    const detailedResult = await db.query(
      `
      SELECT
        a.id,
        a.appointment_date,
        a.service,
        a.price,
        a.tip,
        a.paid,
        a.notes,
        c.id AS client_id,
        c.name AS client_name
      FROM appointments a
      JOIN clients c ON c.id = a.client_id
      WHERE a.user_id = $1
        AND a.paid = true
        AND EXTRACT(YEAR FROM a.appointment_date) = $2
        ${clientFilter}
      ORDER BY a.appointment_date ASC, c.name ASC;
      `,
      params
    );

    // Summary totals
    let serviceTotal = 0;
    let tipTotal = 0;
    detailedResult.rows.forEach((row) => {
      serviceTotal += parseFloat(row.price || 0);
      tipTotal += parseFloat(row.tip || 0);
    });

    const grandTotal = serviceTotal + tipTotal;

    // If a specific client is requested, get their name
    let clientName = null;
    if (clientId && detailedResult.rows.length > 0) {
      clientName = detailedResult.rows[0].client_name;
    }

    res.json({
      success: true,
      year,
      client_id: clientId,
      client_name: clientName,
      appointments: detailedResult.rows,
      totals: {
        service_total: serviceTotal.toFixed(2),
        tip_total: tipTotal.toFixed(2),
        grand_total: grandTotal.toFixed(2),
        count: detailedResult.rows.length,
      },
    });
  } catch (err) {
    console.error('Error generating detailed report:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate detailed report',
    });
  }
});

// GET /api/reports/detailed/pdf?year=2025&client_id=123
router.get('/detailed/pdf', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = getYearFromQuery(req.query.year);
    const clientId = req.query.client_id || null;

    const params = [userId, year];
    let clientFilter = '';

    if (clientId) {
      params.push(clientId);
      clientFilter = 'AND a.client_id = $3';
    }

    const detailedResult = await db.query(
      `
      SELECT
        a.id,
        a.appointment_date,
        a.service,
        a.price,
        a.tip,
        a.paid,
        a.notes,
        c.id AS client_id,
        c.name AS client_name
      FROM appointments a
      JOIN clients c ON c.id = a.client_id
      WHERE a.user_id = $1
        AND a.paid = true
        AND EXTRACT(YEAR FROM a.appointment_date) = $2
        ${clientFilter}
      ORDER BY c.name ASC, a.appointment_date ASC;
      `,
      params
    );

    let serviceTotal = 0;
    let tipTotal = 0;
    detailedResult.rows.forEach((row) => {
      serviceTotal += parseFloat(row.price || 0);
      tipTotal += parseFloat(row.tip || 0);
    });
    const grandTotal = serviceTotal + tipTotal;

    let clientName = null;
    if (clientId && detailedResult.rows.length > 0) {
      clientName = detailedResult.rows[0].client_name;
    }

    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nails-by-brooke-detailed-report-${year}${
        clientName ? '-' + clientName.replace(/\s+/g, '_') : ''
      }.pdf"`
    );

    doc.pipe(res);

    const fmt = (n) =>
      typeof n === 'number'
        ? n.toFixed(2)
        : parseFloat(n || 0).toFixed(2);

    // Title
    doc.fontSize(18).text('Nails by Brooke – Detailed Income Report', {
      align: 'center',
    });
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Year: ${year}`, { align: 'center' });
    if (clientName) {
      doc.fontSize(12).text(`Client: ${clientName}`, { align: 'center' });
    } else {
      doc.fontSize(12).text('Client: All clients', { align: 'center' });
    }
    doc.moveDown(1);

    // Table header
    doc.fontSize(11).text(
      'Date        Client                 Service                       Price   Tip   Total',
      { underline: true }
    );
    doc.moveDown(0.3);

    if (detailedResult.rows.length === 0) {
      doc.fontSize(11).text('No paid appointments found for these filters.');
      doc.end();
      return;
    }

    detailedResult.rows.forEach((row) => {
      const date = new Date(row.appointment_date).toLocaleDateString(
        'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' }
      );
      const total =
        parseFloat(row.price || 0) + parseFloat(row.tip || 0);

      // crude fixed-width layout
      const line = [
        date.padEnd(12),
        (row.client_name || '').padEnd(22),
        (row.service || '').padEnd(28),
        `$${fmt(row.price)}`.padEnd(8),
        `$${fmt(row.tip)}`.padEnd(7),
        `$${fmt(total)}`,
      ].join(' ');

      doc.fontSize(10).text(line);
    });

    doc.moveDown(1);

    // Summary totals
    doc.fontSize(13).text('Summary Totals', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).text(
      `Service Income: $${fmt(serviceTotal)}\n` +
        `Tips:           $${fmt(tipTotal)}\n` +
        `Total:          $${fmt(grandTotal)}\n` +
        `Appointments:   ${detailedResult.rows.length}`
    );

    doc.moveDown(1);
    doc.fontSize(9).text(
      'Note: This report includes only paid appointments (paid = true).',
      { align: 'left' }
    );

    doc.end();
  } catch (err) {
    console.error('Error generating detailed PDF report:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate detailed PDF report',
      });
    }
  }
});

// GET /api/reports/detailed/csv?year=2025&client_id=123
router.get('/detailed/csv', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = getYearFromQuery(req.query.year);
    const clientId = req.query.client_id || null;

    const params = [userId, year];
    let clientFilter = '';

    if (clientId) {
      params.push(clientId);
      clientFilter = 'AND a.client_id = $3';
    }

    const detailedResult = await db.query(
      `
      SELECT
        a.appointment_date,
        a.service,
        a.price,
        a.tip,
        a.paid,
        a.notes,
        c.name AS client_name
      FROM appointments a
      JOIN clients c ON c.id = a.client_id
      WHERE a.user_id = $1
        AND a.paid = true
        AND EXTRACT(YEAR FROM a.appointment_date) = $2
        ${clientFilter}
      ORDER BY c.name ASC, a.appointment_date ASC;
      `,
      params
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nails-by-brooke-detailed-report-${year}${
        detailedResult.rows.length && clientId
          ? '-' +
            detailedResult.rows[0].client_name.replace(/\s+/g, '_')
          : ''
      }.csv"`
    );

    // CSV header
    const lines = [];
    lines.push(
      [
        'Date',
        'Client',
        'Service',
        'Price',
        'Tip',
        'Total',
        'Paid',
        'Notes',
      ].join(',')
    );

    detailedResult.rows.forEach((row) => {
      const date = new Date(row.appointment_date).toISOString().slice(0, 10);
      const price = parseFloat(row.price || 0);
      const tip = parseFloat(row.tip || 0);
      const total = price + tip;

      // Escape notes & service so commas don't break CSV
      const svc = (row.service || '').replace(/"/g, '""');
      const notes = (row.notes || '').replace(/"/g, '""');
      const clientName = (row.client_name || '').replace(/"/g, '""');

      lines.push(
        [
          date,
          `"${clientName}"`,
          `"${svc}"`,
          price.toFixed(2),
          tip.toFixed(2),
          total.toFixed(2),
          row.paid ? 'Yes' : 'No',
          `"${notes}"`,
        ].join(',')
      );
    });

    const csv = lines.join('\n');
    res.send(csv);
  } catch (err) {
    console.error('Error generating detailed CSV report:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate CSV report',
      });
    }
  }
});

module.exports = router;
