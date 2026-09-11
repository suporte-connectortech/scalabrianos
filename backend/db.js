const mysql = require('mysql2/promise');
require('dotenv').config();

const clean = (val) => typeof val === 'string' ? val.replace(/^["']|["']$/g, '').trim() : val;

// Configure optimal pool settings for serverless/shared MySQL hosting (HostGator)
const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '2', 10);

function getOrCreatePool() {
  if (global.__mysqlPool) {
    return global.__mysqlPool;
  }

  const pool = mysql.createPool({
    host: clean(process.env.DB_HOST),
    port: parseInt(clean(process.env.DB_PORT) || '3306', 10),
    user: clean(process.env.DB_USER),
    password: clean(process.env.DB_PASSWORD),
    database: clean(process.env.DB_NAME),
    waitForConnections: true,
    connectionLimit: connectionLimit,
    maxIdle: 1,
    idleTimeout: 8000,
    connectTimeout: 10000,
    queueLimit: 0,
    enableKeepAlive: false
  });

  global.__mysqlPool = pool;
  return pool;
}

const rawPool = getOrCreatePool();

// Retry helper for handling transient HostGator connection limit peaks
const executeWithRetry = async (fn, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const errMsg = (err?.message || '').toLowerCase();
      const errCode = (err?.code || '').toUpperCase();
      
      const isConnectionLimitError = 
        errMsg.includes('max_user_connections') ||
        errMsg.includes('too many connections') ||
        errCode === 'ER_USER_LIMIT_REACHED' ||
        errCode === 'ER_CON_COUNT_ERROR' ||
        errCode === 'PROTOCOL_CONNECTION_LOST' ||
        errCode === 'ECONNRESET' ||
        errCode === 'ETIMEDOUT';

      if (isConnectionLimitError && attempt < maxRetries) {
        const delay = attempt * 400 + Math.floor(Math.random() * 200);
        console.warn(`[DB_RETRY] Temporary connection limit reached (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
};

const dbProxy = {
  query: (...args) => executeWithRetry(() => rawPool.query(...args)),
  execute: (...args) => executeWithRetry(() => rawPool.execute(...args)),
  getConnection: () => rawPool.getConnection(),
  end: () => rawPool.end()
};

module.exports = dbProxy;
