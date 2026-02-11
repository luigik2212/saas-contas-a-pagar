const express = require('express');
const { z } = require('zod');
const pool = require('../db');

const router = express.Router();

const statusEnum = z.enum(['OPEN', 'PAID']);

const createSchema = z.object({
  title: z.string().min(1),
  amount_cents: z.number().int().positive(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: statusEnum.default('OPEN').optional(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().nullable().optional(),
  category_id: z.number().int().nullable().optional()
});

const updateSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, 'Informe ao menos 1 campo');

function monthBounds(month) {
  const base = month ? `${month}-01` : `${new Date().toISOString().slice(0, 7)}-01`;
  const start = new Date(`${base}T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

router.get('/', async (req, res) => {
  const schema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    status: z.enum(['all', 'open', 'paid', 'today', 'overdue']).default('all').optional(),
    category_id: z.string().optional(),
    search: z.string().optional(),
    page: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { month, status = 'all', category_id, search } = parsed.data;
  const page = Math.max(Number(parsed.data.page || 1), 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  const [start, end] = monthBounds(month);

  const where = ['b.user_id = ?', 'b.due_date >= ?', 'b.due_date < ?'];
  const params = [req.user.id, start, end];

  if (status === 'open') where.push("b.status = 'OPEN'");
  if (status === 'paid') where.push("b.status = 'PAID'");
  if (status === 'today') where.push("b.status = 'OPEN' AND b.due_date = CURDATE()");
  if (status === 'overdue') where.push("b.status = 'OPEN' AND b.due_date < CURDATE()");

  if (category_id) {
    where.push('b.category_id = ?');
    params.push(Number(category_id));
  }

  if (search) {
    where.push('(b.title LIKE ? OR b.notes LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await pool.query(
    `SELECT b.*, c.name AS category_name
     FROM bills b
     LEFT JOIN categories c ON c.id = b.category_id AND c.user_id = b.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY b.due_date ASC, b.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM bills b WHERE ${where.join(' AND ')}`,
    params
  );

  return res.json({
    data: rows,
    pagination: { page, limit, total: Number(countRows[0].total) }
  });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const userId = req.user.id;
  const bill = parsed.data;

  if (bill.category_id) {
    const [cat] = await pool.query('SELECT id FROM categories WHERE id = ? AND user_id = ? LIMIT 1', [bill.category_id, userId]);
    if (!cat.length) return res.status(400).json({ error: 'Categoria inválida' });
  }

  const [result] = await pool.query(
    `INSERT INTO bills (title, amount_cents, due_date, status, paid_at, notes, category_id, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bill.title,
      bill.amount_cents,
      bill.due_date,
      bill.status || 'OPEN',
      bill.paid_at || null,
      bill.notes || null,
      bill.category_id || null,
      userId
    ]
  );

  return res.status(201).json({ id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const userId = req.user.id;

  if (parsed.data.category_id) {
    const [cat] = await pool.query('SELECT id FROM categories WHERE id = ? AND user_id = ? LIMIT 1', [parsed.data.category_id, userId]);
    if (!cat.length) return res.status(400).json({ error: 'Categoria inválida' });
  }

  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    fields.push(`${key} = ?`);
    params.push(value);
  }

  const [result] = await pool.query(
    `UPDATE bills SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    [...params, id, userId]
  );

  if (!result.affectedRows) return res.status(404).json({ error: 'Conta não encontrada' });
  return res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  const [result] = await pool.query('DELETE FROM bills WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Conta não encontrada' });
  return res.json({ ok: true });
});

router.post('/:id/pay', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  const schema = z.object({ paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const paidAt = parsed.data.paid_at || new Date().toISOString().slice(0, 10);
  const [result] = await pool.query(
    "UPDATE bills SET status = 'PAID', paid_at = ? WHERE id = ? AND user_id = ?",
    [paidAt, id, req.user.id]
  );

  if (!result.affectedRows) return res.status(404).json({ error: 'Conta não encontrada' });
  return res.json({ ok: true });
});

router.post('/:id/reopen', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  const [result] = await pool.query(
    "UPDATE bills SET status = 'OPEN', paid_at = NULL WHERE id = ? AND user_id = ?",
    [id, req.user.id]
  );

  if (!result.affectedRows) return res.status(404).json({ error: 'Conta não encontrada' });
  return res.json({ ok: true });
});

router.get('/meta/categories', async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM categories WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
  return res.json(rows);
});

module.exports = router;
