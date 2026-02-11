const express = require('express');
const { z } = require('zod');
const pool = require('../db');

const router = express.Router();

function getMonthRange(month) {
  const base = month ? `${month}-01` : `${new Date().toISOString().slice(0, 7)}-01`;
  const start = new Date(`${base}T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    month: start.toISOString().slice(0, 7)
  };
}

router.get('/', async (req, res) => {
  const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Parâmetro month inválido' });

  const { start, end, month } = getMonthRange(parsed.data.month);
  const prevStartDate = new Date(`${start}T00:00:00`);
  prevStartDate.setMonth(prevStartDate.getMonth() - 1);
  const prevEndDate = new Date(`${start}T00:00:00`);

  const prevStart = prevStartDate.toISOString().slice(0, 10);
  const prevEnd = prevEndDate.toISOString().slice(0, 10);
  const userId = req.user.id;

  const [totalsRows] = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN status='OPEN' THEN amount_cents ELSE 0 END),0) AS total_open,
      COALESCE(SUM(CASE WHEN status='PAID' THEN amount_cents ELSE 0 END),0) AS total_paid,
      COALESCE(SUM(CASE WHEN status='OPEN' AND due_date < CURDATE() THEN amount_cents ELSE 0 END),0) AS total_overdue,
      COALESCE(SUM(CASE WHEN status='OPEN' AND due_date = CURDATE() THEN 1 ELSE 0 END),0) AS due_today_count
    FROM bills
    WHERE user_id = ? AND due_date >= ? AND due_date < ?`,
    [userId, start, end]
  );

  const [datasetRows] = await pool.query(
    `SELECT DATE_FORMAT(due_date, '%Y-%m-%d') AS day, COALESCE(SUM(amount_cents),0) AS total
     FROM bills
     WHERE user_id = ? AND due_date >= ? AND due_date < ?
     GROUP BY DATE_FORMAT(due_date, '%Y-%m-%d')
     ORDER BY day ASC`,
    [userId, start, end]
  );

  const [currentMonth] = await pool.query(
    `SELECT COALESCE(SUM(amount_cents),0) AS total FROM bills
     WHERE user_id = ? AND due_date >= ? AND due_date < ?`,
    [userId, start, end]
  );

  const [previousMonth] = await pool.query(
    `SELECT COALESCE(SUM(amount_cents),0) AS total FROM bills
     WHERE user_id = ? AND due_date >= ? AND due_date < ?`,
    [userId, prevStart, prevEnd]
  );

  const currentTotal = Number(currentMonth[0].total || 0);
  const prevTotal = Number(previousMonth[0].total || 0);
  const diffValue = currentTotal - prevTotal;
  const diffPercent = prevTotal === 0 ? null : Number((((diffValue / prevTotal) * 100).toFixed(2)));

  return res.json({
    month,
    totals: totalsRows[0],
    comparison: {
      current_total: currentTotal,
      previous_total: prevTotal,
      diff_value: diffValue,
      diff_percent: diffPercent
    },
    chart: datasetRows
  });
});

module.exports = router;
