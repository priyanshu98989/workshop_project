require('dotenv').config();

const requiredVars = 'JWT_SECRET';
const missing = requiredVars
  .split(',')
  .map((v) => v.trim())
  .filter((v) => !process.env[v]);

if (missing.length) {
  console.warn(`[env] Missing required vars: ${missing.join(', ')}. Using insecure fallbacks.`);
}

const isPlaceholder = (value) => !value || /your_.*_here/.test(value);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  mongodbUri: process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017/civiceye',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  hasGeminiKey: !isPlaceholder(process.env.GEMINI_API_KEY),
  isPlaceholder,
};