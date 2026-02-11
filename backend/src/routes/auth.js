const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const pool = require('../db');
const { createDefaultCategories } = require('../seed/categories');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' }
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, email, password } = parsed.data;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash]
    );

    const userId = result.insertId;
    await createDefaultCategories(connection, userId);

    await connection.commit();

    req.session.user = { id: userId, name, email };
    return res.status(201).json({ id: userId, name, email });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ error: 'Erro ao registrar usuário' });
  } finally {
    connection.release();
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const [rows] = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1', [email]);

  if (!rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

  req.session.user = { id: user.id, name: user.name, email: user.email };
  return res.json(req.session.user);
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(process.env.SESSION_COOKIE_NAME || 'saas_sid');
    return res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json(req.session.user);
});

module.exports = router;
