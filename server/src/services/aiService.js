const { geminiApiKey } = require('../config/env');
const logger = require('../utils/logger');

const AI_MODEL = 'gemini-flash-latest';
const AI_API_VERSION = 'v1beta';
const AI_URL = `https://generativelanguage.googleapis.com/${AI_API_VERSION}/models/${AI_MODEL}:generateContent`;

const PROMPT = `Analyze this civic issue image and act as an intelligent agent: you must detect the issue, decide the owning department, judge its priority, and choose the next action to take.
Return JSON only:
{
  "category": "pothole"|"garbage"|"water leakage"|"broken streetlight"|"road obstruction"|"drainage blockage"|"other",
  "severity": "low"|"medium"|"high",
  "confidence": number between 0 and 1,
  "description": "short description of the issue",
  "department": "Roads/Infrastructure"|"Sanitation"|"Electrical"|"Water Department"|"General"|"",
  "priority": "low"|"medium"|"high"|"critical",
  "nextAction": "create_complaint"|"suggest_merge"|"not_a_civic_issue"
}
Pick the matching department: pothole/road obstruction -> Roads/Infrastructure; garbage/drainage blockage -> Sanitation; broken streetlight -> Electrical; water leakage -> Water Department. Pick priority from the visible severity AND how many people are likely affected. nextAction should be "create_complaint" for civic issues. Respond with JSON only.`;

const FALLBACK_RESULT = Object.freeze({
  category: 'other',
  severity: 'medium',
  confidence: 0,
  description: 'Auto-classification failed.',
  department: '',
  priority: 'medium',
  nextAction: 'create_complaint',
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

function isSupportedDepartment(department) {
  return [
    'Roads/Infrastructure',
    'Sanitation',
    'Electrical',
    'Water Department',
    'General',
    '',
  ].includes(department);
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
    const priority = ['low', 'medium', 'high', 'critical'].includes(parsed.priority)
      ? parsed.priority
      : severity === 'high'
      ? 'high'
      : 'medium';
    const department = isSupportedDepartment(parsed.department) ? parsed.department : '';
    const nextAction =
      ['create_complaint', 'suggest_merge', 'not_a_civic_issue'].includes(parsed.nextAction)
        ? parsed.nextAction
        : 'create_complaint';

    return {
      category,
      severity,
      confidence,
      description: parsed.description || '',
      department,
      priority,
      nextAction,
      raw: text,
    };
  } catch (err) {
    logger.error(`AI classification failed: ${err.message}`);
    return { ...FALLBACK_RESULT };
  }
}

module.exports = { classifyCivicIssue };