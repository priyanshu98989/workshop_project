const { geminiApiKey } = require('../config/env');
const { generate, stripJsonFences } = require('./geminiService');
const logger = require('../utils/logger');

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
  // Left empty on purpose: complaintService builds the stored description from
  // this field, and the user's own note is appended to it. A placeholder string
  // here would end up persisted inside the complaint text.
  description: '',
  department: '',
  priority: 'medium',
  nextAction: 'create_complaint',
});

const SUPPORTED_CATEGORIES = [
  'pothole',
  'garbage',
  'water leakage',
  'broken streetlight',
  'road obstruction',
  'drainage blockage',
  'other',
];

const SUPPORTED_DEPARTMENTS = [
  'Roads/Infrastructure',
  'Sanitation',
  'Electrical',
  'Water Department',
  'General',
  '',
];

function isSupportedCategory(category) {
  return SUPPORTED_CATEGORIES.includes(category);
}

function isSupportedDepartment(department) {
  return SUPPORTED_DEPARTMENTS.includes(department);
}

async function classifyCivicIssue(imageBase64, mimeType = 'image/jpeg') {
  if (!geminiApiKey) {
    logger.warn('AI classification skipped: GEMINI_API_KEY not configured.');
    return { ...FALLBACK_RESULT };
  }

  try {
    // geminiService owns the transport, so classification inherits its request
    // timeout, its retry on 429/5xx and its multi-part response handling.
    const text = await generate({
      systemPrompt: PROMPT,
      imageBase64,
      mimeType,
      json: true,
      temperature: 0.2,
    });

    const parsed = text ? JSON.parse(stripJsonFences(text)) : {};

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
      description: typeof parsed.description === 'string' ? parsed.description : '',
      department,
      priority,
      nextAction,
    };
  } catch (err) {
    logger.error(`AI classification failed: ${err.message}`);
    return { ...FALLBACK_RESULT };
  }
}

module.exports = { classifyCivicIssue };
