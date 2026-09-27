const { geminiApiKey } = require('../config/env');
const logger = require('../utils/logger');

const AI_MODEL = 'gemini-flash-latest';
const AI_API_VERSION = 'v1beta';
const AI_URL = `https://generativelanguage.googleapis.com/${AI_API_VERSION}/models/${AI_MODEL}:generateContent`;
// Without this a stalled upstream connection holds the whole request open for
// as long as undici's default headers timeout allows.
const REQUEST_TIMEOUT_MS = 30000;

const isRetryableStatus = (status) => status === 429 || status >= 500;

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

async function requestOnce(body) {
  const response = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiApiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.ok) return response.json();

  // The provider's own error body can be large and can echo the request, so it
  // is logged rather than folded into the message that reaches the client.
  const detail = await response.text().catch(() => '');
  const err = new Error(`Gemini API ${response.status}`);
  err.status = response.status;
  err.retryable = isRetryableStatus(response.status);
  err.detail = detail;
  throw err;
}

function extractText(data) {
  const candidate = data?.candidates?.[0];
  const blockReason = data?.promptFeedback?.blockReason || candidate?.finishReason;
  if (blockReason && blockReason !== 'STOP') {
    throw new Error(`Gemini returned no usable text (${blockReason}).`);
  }
  // A response is not confined to parts[0]: multi-part and multimodal replies
  // split their text across several parts, so reading only the first one
  // silently truncates the answer.
  const parts = candidate?.content?.parts || [];
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
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
      return extractText(await requestOnce(body));
    } catch (err) {
      lastError = err;
      // Timeouts and socket resets are worth another go just like 429/5xx.
      const retryable = err.retryable || err.name === 'AbortError' || err.name === 'TypeError';
      // The provider's explanation is stripped from err.message so it never
      // reaches the client, so it has to be logged here or it is lost entirely.
      if (err.detail) {
        logger.warn(`Gemini upstream detail: ${err.detail.slice(0, 500)}`);
      }
      if (!retryable || attempt === retries) throw err;
      const delay = attempt * 2000;
      logger.warn(
        `${err.message}${err.detail ? ` — ${err.detail.slice(0, 300)}` : ''}, retrying in ${delay}ms (${attempt}/${retries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
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