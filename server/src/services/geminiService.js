const { geminiApiKey } = require('../config/env');
const logger = require('../utils/logger');

const AI_MODEL = 'gemini-flash-latest';
const AI_API_VERSION = 'v1beta';
const AI_URL = `https://generativelanguage.googleapis.com/${AI_API_VERSION}/models/${AI_MODEL}:generateContent`;

function buildParts({ systemPrompt, history = [], userText, imageBase64, mimeType }) {
  const parts = [];
  if (systemPrompt) {
    parts.push({ text: `System instructions: ${systemPrompt}` });
  }
  for (const m of history.slice(-12)) {
    if (!m || !m.content) continue;
    const role = m.role === 'user' ? 'User' : 'Assistant';
    parts.push({ text: `${role}: ${m.content}` });
  }
  if (userText) {
    parts.push({ text: `User: ${userText}` });
  }
  if (imageBase64) {
    parts.push({
      inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 },
    });
  }
  if (parts.length === 0) parts.push({ text: 'Hello.' });
  return parts;
}

async function generate(options = {}) {
  const {
    systemPrompt,
    history,
    userText,
    imageBase64,
    mimeType,
    json = false,
    temperature = 0.4,
    retries = 3,
  } = options;

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const body = {
    contents: [{ parts: buildParts({ systemPrompt, history, userText, imageBase64, mimeType }) }],
    generationConfig: {
      temperature,
      maxOutputTokens: 1024,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(AI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Gemini API ${response.status}`);
        if (attempt < retries) {
          const delay = attempt * 2000;
          logger.warn(`Gemini API ${response.status}, retrying in ${delay}ms (${attempt}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Gemini API ${response.status}: ${detail}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return typeof text === 'string' ? text.trim() : '';
    } catch (err) {
      lastError = err;
      if (err.message.startsWith('Gemini API 429') || err.message.startsWith('Gemini API 5')) {
        if (attempt < retries) {
          const delay = attempt * 2000;
          logger.warn(`${err.message}, retrying in ${delay}ms (${attempt}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw err;
    }
  }

  throw lastError || new Error('Gemini request failed');
}

function stripJsonFences(raw) {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

module.exports = { generate, stripJsonFences };