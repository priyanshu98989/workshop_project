const { geminiApiKey } = require('../config/env');
const logger = require('../utils/logger');

const AI_MODEL = 'gemini-flash-latest';
const AI_API_VERSION = 'v1beta';
const AI_URL = `https://generativelanguage.googleapis.com/${AI_API_VERSION}/models/${AI_MODEL}:generateContent`;

const PROMPT = `Analyze this civic issue image. Return JSON: {"category": "pothole"|"garbage"|"water leakage"|"broken streetlight"|"road obstruction"|"drainage blockage"|"other", "severity": "low"|"medium"|"high", "confidence": number between 0 and 1, "description": "short description of the issue"}. Respond with JSON only.`;

const FALLBACK_RESULT = Object.freeze({
  category: 'other',
  severity: 'medium',
  confidence: 0,
  description: 'Auto-classification failed.',
});

function sanitizeJson(raw) {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/, '');
}

function isSupportedCategory(category) {
  return [
    'pothole',
    'garbage',
    'water leakage',
    'broken streetlight',
    'road obstruction',
    'drainage blockage',
    'other',
  ].includes(category);
}

async function classifyCivicIssue(imageBase64, mimeType = 'image/jpeg') {
  if (!geminiApiKey) {
    logger.warn('AI classification skipped: GEMINI_API_KEY not configured.');
    return { ...FALLBACK_RESULT };
  }

  try {
    const response = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Gemini API returned ${response.status}: ${body}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = typeof text === 'string' ? JSON.parse(sanitizeJson(text)) : {};

    const category = isSupportedCategory(parsed.category) ? parsed.category : 'other';
    const severity = ['low', 'medium', 'high'].includes(parsed.severity)
      ? parsed.severity
      : 'medium';
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

    return {
      category,
      severity,
      confidence,
      description: parsed.description || '',
      raw: text,
    };
  } catch (err) {
    logger.error(`AI classification failed: ${err.message}`);
    return { ...FALLBACK_RESULT };
  }
}

module.exports = { classifyCivicIssue };