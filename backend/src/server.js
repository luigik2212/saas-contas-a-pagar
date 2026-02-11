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

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (req.path === '/api/auth/login' || req.path === '/api/auth/register') return next();
  return requireAuth(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/export', exportRoutes);

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
