const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeToFile(level, message) {
  ensureLogDir();
  const stamp = new Date().toISOString();
  const line = `${stamp} [${level}] ${message}\n`;
  fs.appendFileSync(path.join(LOG_DIR, `${level}.log`), line);
}

const formatArgs = (args) =>
  args
    .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
    .join(' ');

const logger = {
  info: (...args) => {
    const message = formatArgs(args);
    console.log(`[${new Date().toISOString()}] [INFO] ${message}`);
    if (env !== 'test') writeToFile('info', message);
  },
  warn: (...args) => {
    const message = formatArgs(args);
    console.warn(`[${new Date().toISOString()}] [WARN] ${message}`);
    if (env !== 'test') writeToFile('warn', message);
  },
  error: (...args) => {
    const message = formatArgs(args);
    console.error(`[${new Date().toISOString()}] [ERROR] ${message}`);
    if (env !== 'test') writeToFile('error', message);
  },
};

module.exports = logger;