const path = require('path');
const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
const sessionMiddleware = require('./sessionStore');
const { requireAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const billsRoutes = require('./routes/bills');
const exportRoutes = require('./routes/export');

dotenv.config();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/bills', requireAuth, billsRoutes);
app.use('/api/export', requireAuth, exportRoutes);

app.use('/api', (_req, res) => {
  return res.status(404).json({ error: 'Rota da API não encontrada' });
});

const frontendPath = path.resolve(__dirname, '../../frontend/public');
app.use(express.static(frontendPath));

app.get('/pages/:page', (req, res, next) => {
  const { page } = req.params;
  if (!page || page.includes('.')) return next();
  return res.redirect(302, `/pages/${page}.html`);
});

app.get('/', (_req, res) => {
  return res.sendFile(path.join(frontendPath, 'index.html'));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
