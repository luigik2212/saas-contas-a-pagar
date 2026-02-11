const express = require('express');
const { z } = require('zod');
const pool = require('../db');

const router = express.Router();

function monthBounds(month) {
  const base = month ? `${month}-01` : `${new Date().toISOString().slice(0, 7)}-01`;
  const start = new Date(`${base}T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

router.get('/csv', async (req, res) => {
  const schema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    status: z.enum(['all', 'open', 'paid', 'today', 'overdue']).default('all').optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [start, end] = monthBounds(parsed.data.month);
  const status = parsed.data.status || 'all';

  const where = ['b.user_id = ?', 'b.due_date >= ?', 'b.due_date < ?'];
  const params = [req.user.id, start, end];

  if (status === 'open') where.push("b.status = 'OPEN'");
  if (status === 'paid') where.push("b.status = 'PAID'");
  if (status === 'today') where.push("b.status = 'OPEN' AND b.due_date = CURDATE()");
  if (status === 'overdue') where.push("b.status = 'OPEN' AND b.due_date < CURDATE()");

  const [rows] = await pool.query(
    `SELECT b.id, b.title, b.amount_cents, b.due_date, b.status, b.paid_at, b.notes, c.name AS category_name
     FROM bills b
     LEFT JOIN categories c ON c.id = b.category_id AND c.user_id = b.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY b.due_date ASC`,
    params
  );

  const header = 'id,titulo,valor_centavos,vencimento,status,status_label,pago_em,categoria,observacoes';
  const lines = rows.map((r) => {
    let statusLabel = r.status;
    if (r.status === 'OPEN') {
      if (String(r.due_date).slice(0, 10) === new Date().toISOString().slice(0, 10)) statusLabel = 'HOJE';
      else if (new Date(r.due_date) < new Date(new Date().toISOString().slice(0, 10))) statusLabel = 'ATRASO';
    }
    const cols = [
      r.id,
      `"${(r.title || '').replaceAll('"', '""')}"`,
      r.amount_cents,
      String(r.due_date).slice(0, 10),
      r.status,
      statusLabel,
      r.paid_at ? String(r.paid_at).slice(0, 10) : '',
      `"${(r.category_name || '').replaceAll('"', '""')}"`,
      `"${(r.notes || '').replaceAll('"', '""')}"`
    ];
    return cols.join(',');
  });

  const csv = [header, ...lines].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="contas.csv"');
  return res.send(csv);
});

module.exports = router;
