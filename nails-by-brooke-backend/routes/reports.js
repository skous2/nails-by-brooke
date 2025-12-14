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

    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });

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

    // ===== Title =====
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('Nails by Brooke – Income Summary', { align: 'center' });

    doc
      .font('Helvetica')
      .fontSize(12)
      .moveDown(0.3)
      .text(`Year: ${year}`, { align: 'center' })
      .moveDown(1.2);

    // Helper: draw a 4-column table (Month/Year, Service, Tips, Total)
    const drawTable = ({
      heading,
      rows,
      labelKey,
      isMonth,
      startY = doc.y,
    }) => {
      if (!rows || rows.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(11)
          .text(`No data for ${heading}.`, { underline: false })
          .moveDown(1);
        return;
      }

      // Section heading
      let y = startY;
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(heading, 40, y);
      y += 22;

      // Column positions
      const colX = {
        label: 40,
        service: 210,
        tips: 320,
        total: 430,
      };

      // Header row
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(isMonth ? 'Month' : 'Year', colX.label, y);
      doc.text('Service', colX.service, y, { width: 80, align: 'right' });
      doc.text('Tips', colX.tips, y, { width: 80, align: 'right' });
      doc.text('Total', colX.total, y, { width: 80, align: 'right' });
      y += 16;

      // Body rows
      doc.font('Helvetica').fontSize(10);

      rows.forEach((row) => {
        // Page break if needed
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 60;

          // Re-draw header on new page
          doc.font('Helvetica-Bold').fontSize(14).text(heading, 40, y);
          y += 22;
          doc.fontSize(10);
          doc.text(isMonth ? 'Month' : 'Year', colX.label, y);
          doc.text('Service', colX.service, y, { width: 80, align: 'right' });
          doc.text('Tips', colX.tips, y, { width: 80, align: 'right' });
          doc.text('Total', colX.total, y, { width: 80, align: 'right' });
          y += 16;
          doc.font('Helvetica');
        }

        let label;
        if (isMonth) {
          label = new Date(year, row.month - 1, 1).toLocaleString('en-US', {
            month: 'short',
          });
        } else {
          label = String(row.year);
        }

        const service = fmt(row.service_total);
        const tips = fmt(row.tip_total);
        const total = fmt(row.grand_total);

        doc.text(label, colX.label, y);
        doc.text(`$${service}`, colX.service, y, {
          width: 80,
          align: 'right',
        });
        doc.text(`$${tips}`, colX.tips, y, {
          width: 80,
          align: 'right',
        });
        doc.text(`$${total}`, colX.total, y, {
          width: 80,
          align: 'right',
        });

        y += 14;
      });

      doc.moveTo(40, y + 2).lineTo(550, y + 2).strokeColor('#DDDDDD').stroke();
      doc.moveDown(1.2);
    };

    // ===== Monthly table =====
    drawTable({
      heading: 'Monthly Summary (Paid Appointments)',
      rows: monthlyResult.rows,
      labelKey: 'month',
      isMonth: true,
      startY: doc.y,
    });

    // ===== Annual table =====
    drawTable({
      heading: 'Annual Summary (All Years, Paid Appointments)',
      rows: annualResult.rows,
      labelKey: 'year',
      isMonth: false,
      startY: doc.y,
    });

    // Footnote
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#555555')
      .moveDown(0.5)
      .text(
        'Note: This summary includes only appointments marked as paid.',
        40,
        doc.y,
        { width: 520 }
      );

    doc.end();
  } catch (err) {
    console.error('Error generating summary PDF report:', err);
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

    // Totals
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

    // PDF Setup
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nails-by-brooke-detailed-report-${year}${
        clientName ? '-' + clientName.replace(/\s+/g, '_') : ''
      }.pdf"`
    );

    doc.pipe(res);

    // Helpers
    const fmt = (n) =>
      typeof n === 'number'
        ? n.toFixed(2)
        : parseFloat(n || 0).toFixed(2);

    const formatDate = (dateString) =>
      new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

    // Title
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('Nails by Brooke – Detailed Income Report', { align: 'center' })
      .moveDown(0.5);

    doc
      .font('Helvetica')
      .fontSize(12)
      .text(`Year: ${year}`, { align: 'center' });

    doc
      .font('Helvetica')
      .fontSize(12)
      .text(
        `Client: ${clientName ? clientName : 'All Clients'}`,
        { align: 'center' }
      )
      .moveDown(1.2);

    // Column layout
    const colX = {
      date: 40,
      client: 120,
      service: 250,
      price: 420,
      tip: 480,
      total: 530,
    };

    let y = doc.y;

    // Draw header row
    const drawHeader = () => {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Date', colX.date, y)
        .text('Client', colX.client, y)
        .text('Service', colX.service, y)
        .text('Price', colX.price, y, { width: 50, align: 'right' })
        .text('Tip', colX.tip, y, { width: 50, align: 'right' })
        .text('Total', colX.total, y, { width: 50, align: 'right' });
      y += 16;

      doc
        .moveTo(40, y - 4)
        .lineTo(570, y - 4)
        .strokeColor('#CCCCCC')
        .stroke();
    };

    drawHeader();

    // Draw rows
    doc.font('Helvetica').fontSize(10);

    for (let row of detailedResult.rows) {
      const price = parseFloat(row.price || 0);
      const tip = parseFloat(row.tip || 0);
      const total = price + tip;

      // Page break check
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 40;
        drawHeader();
      }

      // Row content
      doc.text(formatDate(row.appointment_date), colX.date, y);
      doc.text(row.client_name, colX.client, y, { width: 120 });

      // Service name may be long → wrap
      doc.text(row.service || '', colX.service, y, { width: 150 });

      doc.text(`$${fmt(price)}`, colX.price, y, { width: 50, align: 'right' });
      doc.text(`$${fmt(tip)}`, colX.tip, y, { width: 50, align: 'right' });
      doc.text(`$${fmt(total)}`, colX.total, y, { width: 50, align: 'right' });

      y += 14;

      // Notes (optional)
      if (row.notes) {
        const noteHeight = doc.heightOfString(row.notes, {
          width: 500,
          align: 'left',
        });

        doc
          .fontSize(9)
          .fillColor('#555555')
          .text(`Notes: ${row.notes}`, 60, y, { width: 500 });

        doc.fillColor('#000000');
        y += noteHeight + 6;
      }
    }

    // Summary totals section
    y += 20;
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('Summary Totals', 40, y);
    y += 18;

    doc.font('Helvetica').fontSize(11);
    doc.text(`Appointments: ${detailedResult.rows.length}`, 40, y);
    y += 14;
    doc.text(`Service Income: $${fmt(serviceTotal)}`, 40, y);
    y += 14;
    doc.text(`Tips: $${fmt(tipTotal)}`, 40, y);
    y += 14;
    doc.text(`Total: $${fmt(grandTotal)}`, 40, y);

    y += 20;

    doc
      .fontSize(9)
      .fillColor('#555555')
      .text('Only appointments marked as PAID are included.', 40, y);

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
