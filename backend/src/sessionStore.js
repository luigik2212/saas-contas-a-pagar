const session = require('express-session');
const MySQLStoreFactory = require('connect-mysql2');
const dotenv = require('dotenv');

dotenv.config();

const MySQLStore = MySQLStoreFactory(session);

const store = new MySQLStore({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true
});

module.exports = session({
  name: process.env.SESSION_COOKIE_NAME || 'saas_sid',
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
});
